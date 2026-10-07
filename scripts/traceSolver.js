// characterWrite / characterTrace solver (e.g. Chinese hanzi).
// Loaded after scripts/solver.js; attaches to DuolingoChallenge.prototype.
Object.assign(DuolingoChallenge.prototype, {

    async solveCharacterWrite() {
        // challengeInfo.strokes contains SVG paths in a width x height box (e.g. 109x109).
        // We replay each stroke as synthetic pointer events on the trace pad.
        const strokes = this.challengeInfo.strokes ?? [];
        window.console.logger({ characterWriteStrokes: strokes.length, width: this.challengeInfo.width, height: this.challengeInfo.height });
        if (!strokes.length) {
            window.console.logger("No strokes to trace, trying skip");
            this.constructor.clickButtonSkip?.();
            return;
        }

        const traceEl = this.findTraceElement();
        window.console.logger({
            traceEl,
            rect: traceEl?.getBoundingClientRect?.()?.toJSON?.(),
            childTags: traceEl ? Array.from(traceEl.querySelectorAll("*")).slice(0, 20).map((e) => e.tagName + "." + e.className.toString().slice(0, 60)) : null,
            htmlHead: traceEl?.outerHTML?.slice(0, 800),
        });
        if (!traceEl) {
            alert("Autolingo: could not find hanzi trace pad. Open DevTools and send the outerHTML of the canvas/svg area.");
            return;
        }

        // 1. Wait until the pad is mounted and stable before drawing.
        await this.waitForTraceReady(traceEl, strokes);

        // 2. Replay strokes synthetically. Re-detect the quiz's active stroke
        // before every draw and stop when nothing remains: extra strokes
        // after completion count as mistakes (BLAMING). Highlight mode
        // retries a stroke the highlight did not leave (GUARDRAIL strokes
        // can stop part-way); abort after 3 consecutive rejects to save hearts.
        const drawn = new Set();
        const track = { highlight: undefined }; // undefined=undetected, null=order mode, string=highlight class
        const preDone = this.doneStrokeIndices(strokes);
        window.console.logger({ preDone: [...preDone] });
        let i = this.findActiveStrokeIndex(strokes, drawn, track, preDone);
        window.console.logger({ startIdx: i });
        let rejects = 0;
        for (let attempt = 0; i >= 0 && i < strokes.length && attempt < strokes.length * 2 + 3; attempt++) {
            if (!traceEl.isConnected) return;
            const st = this.playerStatus();
            if (st && st !== "GUESSING") {
                window.console.logger({ stopOnStatus: st });
                return;
            }
            const before = this.snapshotStrokeSvg();
            const points = this.constructor.parseSvgPathToPoints(strokes[i].path, 24);
            await this.dispatchStroke(traceEl, points, strokes[i].path);
            drawn.add(i);
            const accepted = await this.waitForStrokeDone(traceEl, strokes, i, before, drawn, track, preDone);
            const next = this.findActiveStrokeIndex(strokes, drawn, track, preDone);
            // Highlight mode: the highlight must move (or vanish = complete);
            // unmoved = invalid stroke. Order mode: trust the ink check.
            const ok = track.highlight ? next !== i : accepted;
            rejects = ok ? 0 : rejects + 1;
            if (!ok) window.console.logger({ rejected: i, rejects });
            if (rejects >= 3) {
                alert("Autolingo: stopping trace early (3 strokes not accepted) to save hearts. Finish manually, then Solve again.");
                return;
            }
            if (track.highlight && next < 0) {
                window.console.logger({ traceComplete: true });
                return;
            }
            i = next;
        }
    },

    findTraceElement() {
        // Only look inside the write/trace challenge. Selectors live in
        // SELECTORS.tracePad / challengeRoot (scripts/selectors.js).
        const root = queryFirst(SELECTORS.challengeRoot);
        if (!root) return null;
        const isBig = (e) => {
            const r = e.getBoundingClientRect?.();
            return r && r.width > 80 && r.height > 80;
        };
        for (const sel of SELECTORS.tracePad) {
            // Prefer the largest visible element (the trace pad, not icons).
            const visible = Array.from(root.querySelectorAll(sel)).filter(isBig);
            if (visible.length) {
                visible.sort((a, b) => {
                    const ra = a.getBoundingClientRect();
                    const rb = b.getBoundingClientRect();
                    return (rb.width * rb.height) - (ra.width * ra.height);
                });
                window.console.logger({ traceSelector: sel, candidates: visible.length });
                return visible[0];
            }
        }
        // Last resort: the challenge container itself.
        return isBig(root) ? root : null;
    },

    strokeSvgRoot() {
        return queryFirst(SELECTORS.traceSvg);
    },

    doneStrokeIndices(strokes) {
        // Pre-filled strokes have NO trace guide; remaining strokes do.
        // The guide class is picked off the highlighted stroke (it carries a
        // singleton overlay class): among its other classes, the widest
        // coverage wins. Without any singleton, fall back to majority.
        // Lone extra copies (coverage 1) are overlays, never guides.
        // Classes on PREDRAWN strokes are finished ink, never guides.
        // Redrawing done strokes counts as a mistake, so skip them.
        const ink = this.inkClasses(strokes);
        if (this.isFreehand(strokes)) {
            // Write mode has no guides and renders future strokes only when
            // they become the target: done = PREDRAWN or rendered as ink.
            const done = new Set(strokes.flatMap((s, i) => (s.strokeDrawMode === "PREDRAWN" ? [i] : [])));
            for (const { idx, cls } of this.strokePaths(strokes)) if (ink.has(cls)) done.add(idx);
            window.console.logger({ writeDone: [...done], ink: [...ink] });
            return done;
        }
        const classSets = strokes.map(() => new Set());
        for (const { idx, cls } of this.strokePaths(strokes)) {
            if (!ink.has(cls)) classSets[idx].add(cls);
        }
        const coverage = new Map(); // class -> Set(idxs)
        classSets.forEach((set, i) => {
            for (const c of set) {
                if (!coverage.has(c)) coverage.set(c, new Set());
                coverage.get(c).add(i);
            }
        });
        const ranked = [...coverage.entries()]
            .map(([c, idxs]) => ({ c, n: idxs.size, min: Math.min(...idxs) }))
            .sort((a, b) => (b.n - a.n) || (a.min - b.min));
        // Highlight = singleton class on the smallest stroke index.
        const singles = ranked.filter((r) => r.n === 1).sort((a, b) => a.min - b.min);
        // Full-coverage classes are ghost/reference layers, never guides —
        // unless nothing else exists (fresh char: guides cover all).
        // Singletons are highlight overlays, last resort only.
        const full = new Set(ranked.filter((r) => r.n === strokes.length).map((r) => r.c));
        const tieredBest = (classes) => {
            const rs = classes
                .map((c) => ranked.find((r) => r.c === c))
                .filter(Boolean)
                .sort((a, b) => (b.n - a.n) || (a.min - b.min));
            const tier = (r) => (r.n > 1 && !full.has(r.c) ? 0 : (full.has(r.c) ? 1 : 2));
            return rs.slice().sort((a, b) => (tier(a) - tier(b)) || (b.n - a.n) || (a.min - b.min))[0];
        };
        let guideClass = null;
        if (singles.length) {
            const hlStroke = singles[0].min;
            const cands = [...classSets[hlStroke]].filter((c) => c !== singles[0].c);
            guideClass = tieredBest(cands)?.c ?? null;
        }
        if (!guideClass) {
            guideClass = tieredBest(ranked.map((r) => r.c))?.c ?? null; // majority fallback
        }
        window.console.logger({ classCoverage: ranked, guideClass });
        const done = new Set(strokes.flatMap((s, i) => (s.strokeDrawMode === "PREDRAWN" ? [i] : [])));
        if (guideClass) {
            classSets.forEach((set, i) => { if (!set.has(guideClass)) done.add(i); });
        }
        return done;
    },

    strokePaths(strokes) {
        // Rendered <path>s that draw one of strokes[] (excludes grid + ink),
        // in DOM order: [{idx, cls, el}].
        const svg = this.strokeSvgRoot();
        const scope = svg ?? queryFirst(SELECTORS.challengeRoot) ?? document;
        return Array.from(scope.querySelectorAll("svg path, path"))
            .map((el) => ({
                idx: this.constructor.matchStrokeIndex(el.getAttribute("d"), strokes),
                cls: `${el.getAttribute("class")}`,
                el,
            }))
            .filter((p) => p.idx >= 0);
    },

    isFreehand(strokes) {
        // characterWrite data: strokes to draw without a guide are FREEHAND.
        return strokes.some((s) => s.strokeDrawMode === "FREEHAND");
    },

    inkClasses(strokes) {
        // Classes of finished ink. Ink can sit on a single stroke and look
        // like the highlight. Ink = rendered PREDRAWN strokes and any path
        // with pathLength (Duolingo animates ink with it, guide and target
        // paths have none; seen in FREEHAND and GUARDRAIL; includes the
        // in-progress ink path, so it works before any stroke).
        const ink = new Set();
        for (const { idx, cls } of this.strokePaths(strokes)) {
            if (strokes[idx].strokeDrawMode === "PREDRAWN") ink.add(cls);
        }
        const scope = this.strokeSvgRoot() ?? queryFirst(SELECTORS.challengeRoot) ?? document;
        for (const p of scope.querySelectorAll("path")) {
            if (p.hasAttribute("pathLength")) ink.add(`${p.getAttribute("class")}`);
        }
        return ink;
    },

    strokeGuides(strokes) {
        // Rendered guide paths mapped to strokes[] indices (excludes grid + ink).
        // Returns Map strokeIdx -> {sig, el}; the first path per stroke wins.
        const seen = new Map();
        for (const { idx, cls, el } of this.strokePaths(strokes)) {
            if (!seen.has(idx)) seen.set(idx, { sig: cls, el });
        }
        return seen;
    },

    async waitForTraceReady(traceEl, strokes) {
        // The status event can fire before the pad finishes mounting (React
        // attaches listeners after first paint). Drawing into an unready pad
        // is silently ignored — the classic "press Solve, nothing happens,
        // press again and it works". Wait for guides present + DOM stable.
        for (let t = 0; t < 5000; t += 250) {
            if (!traceEl.isConnected) return false;
            const a = this.snapshotStrokeSvg();
            await sleep(250);
            const guides = this.strokeGuides(strokes);
            if (a && a === this.snapshotStrokeSvg() && guides.size > 0) {
                window.console.logger({ traceReady: true, guides: guides.size });
                return true;
            }
        }
        window.console.logger({ traceReadyTimeout: true });
        return true; // proceed anyway (previous behavior)
    },

    playerStatus() {
        return getPageData()?.player?.status ?? null;
    },

    findActiveStrokeIndex(strokes, drawn = new Set(), track = {}, preDone = new Set()) {
        // Two modes, decided once per challenge:
        // - highlight mode: some guide has a singleton class (the highlighted
        //   active stroke). Follow it: draw its stroke; when it moves, draw
        //   the next; when it vanishes, the trace is complete (-1).
        // - order mode: all guides look the same (fresh char). Draw smallest
        //   undrawn index (stroke order) until status/disconnect stops us.
        // The highlight is searched among ALL rendered paths: it is often a
        // second path on top of the stroke's guide (GUARDRAIL: "_287Na"
        // guide + "_22UPm" target). Highlight mode may return a drawn
        // stroke (= rejected, retry); order mode never redraws.
        // Returns -1 when nothing remains.
        try {
            const bySig = {};
            for (const { idx, cls } of this.strokePaths(strokes)) (bySig[cls] ??= new Set()).add(idx);
            if (track.highlight === undefined) {
                const ink = this.inkClasses(strokes);
                const singles = Object.entries(bySig).filter(([sig, a]) => a.size === 1 && !ink.has(sig));
                singles.sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
                track.highlight = singles.length ? singles[0][0] : null;
                window.console.logger({ highlightMode: track.highlight, classes: Object.keys(bySig) });
            }
            if (track.highlight) {
                // Highlighted stroke is by definition not done; preDone only
                // gates order mode below.
                const hits = [...(bySig[track.highlight] ?? [])].sort((a, b) => a - b);
                return hits.length ? hits[0] : -1;
            }
            for (let k = 0; k < strokes.length; k++) {
                if (!drawn.has(k) && !preDone.has(k)) return k;
            }
            return -1;
        } catch (e) {
            window.console.logger({ activeDetectFailed: String(e) });
            return drawn.size > 0 ? -1 : 0;
        }
    },

    snapshotStrokeSvg() {
        const svg = this.strokeSvgRoot();
        const scope = svg ?? queryFirst(SELECTORS.challengeRoot);
        if (!scope) return "";
        return Array.from(scope.querySelectorAll("path"))
            .map((p) => `${p.getAttribute("class")}|${p.getAttribute("d")?.length}`)
            .join(";");
    },

    waitForSvgChange(test, timeout) {
        // Resolves true as soon as test() holds after a class/d/transform/
        // child change in the stroke svg (transform: the pen marker moves),
        // false on timeout. Reacts at once instead of on a polling tick.
        if (test()) return Promise.resolve(true);
        const scope = this.strokeSvgRoot() ?? queryFirst(SELECTORS.challengeRoot);
        if (!scope) return sleep(timeout).then(test);
        return new Promise((resolve) => {
            const finish = (v) => { obs.disconnect(); clearTimeout(timer); resolve(v); };
            const obs = new MutationObserver(() => { if (test()) finish(true); });
            const timer = setTimeout(() => finish(test()), timeout);
            obs.observe(scope, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "d", "transform"] });
        });
    },

    async waitForStrokeDone(traceEl, strokes, i, before, drawn, track, preDone) {
        // After drawing stroke i: wait until the quiz is ready for the next
        // one. Returns whether stroke i looks accepted.
        if (track.highlight) {
            // Ready as soon as the highlight leaves stroke i and the pen
            // marker reaches the next stroke's start (a fixed quiet period
            // before showed as a pause before every stroke).
            const active = () => this.findActiveStrokeIndex(strokes, drawn, track, preDone);
            const moved = await this.waitForSvgChange(() => active() !== i, 1000);
            if (moved) await this.waitForMarkerAtStroke(traceEl, strokes, active());
            return moved;
        }
        const accepted = await this.waitForStrokeAccepted(traceEl, i, before);
        // Let validation animations finish: starting the next stroke while
        // the quiz is still settling gets it silently ignored.
        await this.waitForQuiescent();
        return accepted;
    },

    async waitForMarkerAtStroke(traceEl, strokes, idx, timeout = 800) {
        // The pen marker moves to the next stroke's start once the quiz is
        // ready for it; a drag that starts before then grabs nothing.
        if (idx < 0) return;
        const guide = this.findGuidePathEl(strokes[idx].path);
        const start = guide ? this.sampleGuidePathClientCoords(guide, 1000)?.[0] : null;
        const pad = traceEl.tagName?.toLowerCase() === "svg" ? traceEl : traceEl.querySelector("svg") ?? traceEl;
        if (!start || !this.markerClientPoint(pad)) return;
        const there = () => {
            const m = this.markerClientPoint(pad);
            return !!m && Math.hypot(m.clientX - start.clientX, m.clientY - start.clientY) < 4;
        };
        const ok = await this.waitForSvgChange(there, timeout);
        window.console.logger({ markerAtStroke: idx, ok });
    },

    async waitForStrokeAccepted(traceEl, idx, before) {
        // Snapshot was taken BEFORE drawing; wait for any change (ink
        // appears during validation, which can lag pointer events).
        const accepted = await this.waitForSvgChange(() => this.snapshotStrokeSvg() !== before, 1200);
        window.console.logger({ strokeAcceptedPoll: idx, accepted });
        return accepted;
    },

    async waitForQuiescent(timeout = 1500, quietMs = 300) {
        // Validation animations settle asynchronously; the next stroke's
        // pointerdown landing mid-animation is silently ignored. Done once
        // the svg has not changed for quietMs. Not shorter: reading the
        // highlight before it moves redraws the same stroke (a mistake);
        // the old polling never read it sooner than 300ms after pointerup.
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            const prev = this.snapshotStrokeSvg();
            if (!await this.waitForSvgChange(() => this.snapshotStrokeSvg() !== prev, quietMs)) return;
        }
    },

    findGuidePathEl(strokePath) {
        // Rendered guide <path d="..."> should equal challengeInfo path.
        // Match exactly (whitespace-insensitive) to sample true screen coords.
        const { normPath, pathStart } = this.constructor;
        const want = normPath(strokePath);
        const root = queryFirst(SELECTORS.challengeRoot) ?? document;
        const paths = Array.from(root.querySelectorAll("svg path"));
        for (const p of paths) {
            if (normPath(p.getAttribute("d")) === want) return p;
        }
        // Fallback: same start point, compared NUMERICALLY (substring
        // matching can grab a similar-but-wrong stroke's path).
        const wantStart = pathStart(want);
        if (wantStart) {
            const [wx, wy] = wantStart;
            let best = null, bestDist = 1.0;
            for (const p of paths) {
                const start = pathStart(p.getAttribute("d"));
                if (!start) continue;
                const [px, py] = start;
                const dist = Math.hypot(px - wx, py - wy);
                if (dist < bestDist) { bestDist = dist; best = p; }
            }
            if (best) {
                window.console.logger({ guideMatched: "start", dist: bestDist.toFixed(2) });
                return best;
            }
        }
        window.console.logger({ guideMatched: "none" });
        return null;
    },

    sampleGuidePathClientCoords(guideEl, spacingPx = 3) {
        // One point every ~spacingPx screen pixels: fixed counts left long
        // strokes with visible steps.
        try {
            const len = guideEl.getTotalLength();
            const ctm = guideEl.getScreenCTM();
            if (!len || !ctm) return null;
            const n = Math.max(8, Math.ceil((len * Math.hypot(ctm.a, ctm.b)) / spacingPx));
            const out = [];
            for (let k = 0; k <= n; k++) {
                const pt = guideEl.getPointAtLength((len * k) / n);
                const sp = pt.matrixTransform(ctm);
                out.push({ clientX: sp.x, clientY: sp.y });
            }
            return out;
        } catch (e) {
            window.console.logger({ guideSampleFailed: String(e) });
            return null;
        }
    },

    strokeBoxToClient(points) {
        // Map stroke-box points (e.g. 0..109) to client coords through the
        // screen transform of the box: from a rendered stroke path, else
        // the scaled group that holds them. Exact even when the box does
        // not fill the pad (马: 287px box centered in a 307px pad).
        // Returns null when no transform is available.
        const svg = this.strokeSvgRoot();
        if (!svg) return null;
        const el = this.strokePaths(this.challengeInfo.strokes ?? [])[0]?.el ?? svg.querySelector("g[transform]");
        let m = null;
        try { m = el?.getScreenCTM?.() ?? null; } catch (e) { m = null; }
        if (!m) return null;
        return points.map(([x, y]) => ({ clientX: m.a * x + m.c * y + m.e, clientY: m.b * x + m.d * y + m.f }));
    },

    markerClientPoint(pad) {
        // Client coords of the pen marker's center, or null. Its circle is
        // centered on the group origin, so the box center is that point.
        const marker = queryFirst(SELECTORS.traceMarker, pad, true);
        const r = marker?.getBoundingClientRect?.();
        if (!r || !r.width) return null;
        return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    },

    resumeAtMarker(moves, marker, maxDist = 4) {
        // GUARDRAIL: a part-way attempt leaves the marker mid-stroke, and
        // only a drag that starts ON it continues the stroke. If the marker
        // lies on this stroke, start there; otherwise draw it whole.
        if (!marker) return moves;
        let best = -1, bestDist = maxDist;
        moves.forEach((m, k) => {
            const d = Math.hypot(m.clientX - marker.clientX, m.clientY - marker.clientY);
            if (d < bestDist) { bestDist = d; best = k; }
        });
        if (best <= 0) return moves;
        // Always end at the real end, even when the marker sits next to it.
        return [marker, ...(best < moves.length - 1 ? moves.slice(best + 1) : moves.slice(-1))];
    },

    async playMoves(moves, onMove) {
        // ONE move per animation frame, like real touch input (browsers
        // coalesce moves per frame); several per frame each force a layout
        // in Duolingo's handler ("[Violation] Forced reflow") and the ink
        // stutters. Step sizes come from simplifyMoves. rAF stalls in a
        // hidden tab, so a timer backs it up.
        const frame = () => new Promise((r) => {
            const timer = setTimeout(r, 50);
            window.requestAnimationFrame?.(() => { clearTimeout(timer); r(); });
        });
        const t0 = performance.now();
        for (let k = 1; k < moves.length; k++) {
            await frame();
            onMove(moves[k], moves[k - 1]);
        }
        window.console.logger({ moves: moves.length, strokeMs: Math.round(performance.now() - t0) });
    },

    async dispatchStroke(traceEl, points, strokePath = null) {
        if (!points.length) return;
        const svgRoot = traceEl.tagName?.toLowerCase() === "svg" ? traceEl : traceEl.querySelector("svg");
        const boxW = this.challengeInfo.width || 109;
        const boxH = this.challengeInfo.height || 109;
        const rect = (svgRoot ?? traceEl).getBoundingClientRect();
        const toClient = ([x, y]) => ({
            clientX: rect.left + (x / boxW) * rect.width,
            clientY: rect.top + (y / boxH) * rect.height,
        });

        // Prefer exact screen coords from the rendered guide path itself:
        // getPointAtLength + getScreenCTM removes all scale/offset guessing.
        let moves = null;
        let guideUsed = false;
        if (strokePath) {
            const guideEl = this.findGuidePathEl(strokePath);
            const sampled = guideEl ? this.sampleGuidePathClientCoords(guideEl, 2) : null;
            if (sampled?.length) {
                moves = sampled;
                guideUsed = true;
            }
        }
        const dense = moves ? null : this.constructor.interpolatePoints(points, 0.75);
        if (!moves) moves = this.strokeBoxToClient(dense);
        if (!moves) {
            // Last resort: assume the box fills the pad (can be off by a
            // few px when Duolingo adds a margin).
            moves = dense.map(toClient);
        }
        const pad = svgRoot ?? traceEl;
        // Carry the pen a few px past the end: the marker lags the pen and
        // stopped 1-2.5px short when released at the end (identical
        // repeated moves did not advance it). It cannot pass the end, so
        // the overshoot pulls it all the way.
        const overshoot = this.constructor.overshoot(moves);
        moves = [...this.constructor.simplifyMoves(this.resumeAtMarker(moves, this.markerClientPoint(pad))), ...overshoot];
        const first = moves[0];
        const last = moves[moves.length - 1];
        window.console.logger({ guideUsed, movePoints: moves.length });

        // The pad handles only mouse + touch events (React props on the
        // svg: onMouseDown/Move/Up, onTouch*). One mouse event per step:
        // every extra event type or target ran the handler again (~14ms
        // per step with the old pointer+mouse+touch fan-out). The target is
        // the element under the start point: GUARDRAIL only starts a drag
        // that grabs the pen marker there; events bubble to the svg.
        const under = document.elementFromPoint?.(first.clientX, first.clientY);
        const target = under && pad.contains(under) ? under : pad;
        const mouse = (type, c, buttons) => {
            try {
                target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, ...c, buttons }));
            } catch (e) {
                window.console.logger({ dispatchFailed: type, e: String(e) });
            }
        };

        // Hover to the start point first (no buttons): mimics aiming and
        // avoids the teleport from the previous stroke-end counting as ink.
        mouse("mousemove", first, 0);
        await sleep(20);
        mouse("mousedown", first, 1);
        await this.playMoves(moves, (c) => mouse("mousemove", c, 1));
        mouse("mouseup", last, 0);
        window.console.logger({ strokeDrawn: moves.length });
    },
});

Object.assign(DuolingoChallenge, {

    normPath(d) {
        // Path "d" strings compare equal regardless of whitespace.
        return (d ?? "").replace(/\s+/g, " ").trim();
    },

    pathStart(d) {
        // First "x,y" pair of a path as numbers, or null.
        const m = DuolingoChallenge.normPath(d).match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
        return m ? m[0].split(",").map(Number) : null;
    },

    matchStrokeIndex(d, strokes) {
        // Index in strokes[] that a rendered path draws, or -1 for grid
        // lines, ink and unknown paths. Exact match first, then start point
        // (numeric precision can differ).
        const { normPath, pathStart } = DuolingoChallenge;
        d = normPath(d);
        if (d.length <= 20 || /[HVhv]/.test(d)) return -1; // grid lines
        const exact = strokes.findIndex((s) => normPath(s.path) === d);
        if (exact >= 0) return exact;
        const start = pathStart(d);
        if (!start) return -1;
        return strokes.findIndex((s) => {
            const s0 = pathStart(s.path);
            return s0 !== null && Math.hypot(start[0] - s0[0], start[1] - s0[1]) < 1.0;
        });
    },

    parseSvgPathToPoints(path, samplesPerCurve = 16) {
        // Sample ON-curve points (dragging through cubic control points,
        // which lie off the curve, trips GUARDRAIL).
        // Supports M, L, C commands used by Duolingo stroke paths.
        const tokens = path.match(/[MLCQZmlcqz]|-?\d+(?:\.\d+)?/g) ?? [];
        let i = 0;
        let cx = 0, cy = 0;
        let startX = 0, startY = 0;
        const pts = [];
        const cubic = (p0, c1, c2, p1, t) => {
            const u = 1 - t;
            return [
                u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p1[0],
                u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p1[1],
            ];
        };
        const readPair = () => {
            let a = parseFloat(tokens[i++]);
            let b;
            if (i < tokens.length && !/[MLCQZmlcqz]/.test(tokens[i])) {
                b = parseFloat(tokens[i++]);
            } else {
                b = 0;
            }
            return [a, b];
        };
        let cmd = null;
        while (i < tokens.length) {
            if (/[MLCQZmlcqz]/.test(tokens[i])) cmd = tokens[i++];
            if (cmd === "M" || cmd === "m") {
                const [x, y] = readPair();
                cx = cmd === "m" ? cx + x : x;
                cy = cmd === "m" ? cy + y : y;
                startX = cx; startY = cy;
                pts.push([cx, cy]);
                cmd = cmd === "M" ? "L" : "l"; // implicit linetos
            } else if (cmd === "L" || cmd === "l") {
                const [x, y] = readPair();
                cx = cmd === "l" ? cx + x : x;
                cy = cmd === "l" ? cy + y : y;
                pts.push([cx, cy]);
            } else if (cmd === "C" || cmd === "c") {
                const rel = cmd === "c";
                const c1 = readPair(), c2 = readPair(), end = readPair();
                const p0 = [cx, cy];
                const C1 = rel ? [cx + c1[0], cy + c1[1]] : c1;
                const C2 = rel ? [cx + c2[0], cy + c2[1]] : c2;
                const P1 = rel ? [cx + end[0], cy + end[1]] : end;
                for (let k = 1; k <= samplesPerCurve; k++) {
                    pts.push(cubic(p0, C1, C2, P1, k / samplesPerCurve));
                }
                cx = P1[0]; cy = P1[1];
            } else if (cmd === "Q" || cmd === "q") {
                const rel = cmd === "q";
                const c = readPair(), end = readPair();
                const C = rel ? [cx + c[0], cy + c[1]] : c;
                const P1 = rel ? [cx + end[0], cy + end[1]] : end;
                for (let k = 1; k <= samplesPerCurve; k++) {
                    const t = k / samplesPerCurve, u = 1 - t;
                    pts.push([u*u*cx + 2*u*t*C[0] + t*t*P1[0], u*u*cy + 2*u*t*C[1] + t*t*P1[1]]);
                }
                cx = P1[0]; cy = P1[1];
            } else if (cmd === "Z" || cmd === "z") {
                cx = startX; cy = startY;
                pts.push([cx, cy]);
            } else {
                i++;
            }
        }
        return pts;
    },

    simplifyMoves(pts, maxStep = 6, tol = 0.1) {
        // Dense client points -> pen steps: long (up to maxStep px) on
        // straight runs, short in tight turns. A step may skip points only
        // if they all lie within tol px of it. Coarse steps through a
        // hairpin lose GUARDRAIL tracking (stroke stops part-way): in 没,
        // 6px steps failed and 2px passed; tol 0.1 gives ~2px there.
        if (pts.length < 3) return pts.slice();
        const dist = [0];
        for (let k = 1; k < pts.length; k++) {
            dist.push(dist[k - 1] + Math.hypot(pts[k].clientX - pts[k - 1].clientX, pts[k].clientY - pts[k - 1].clientY));
        }
        const dev = (p, a, b) => {
            const dx = b.clientX - a.clientX, dy = b.clientY - a.clientY;
            const len = Math.hypot(dx, dy);
            if (!len) return Math.hypot(p.clientX - a.clientX, p.clientY - a.clientY);
            return Math.abs(dx * (a.clientY - p.clientY) - dy * (a.clientX - p.clientX)) / len;
        };
        const fits = (i, j) => {
            if (dist[j] - dist[i] > maxStep) return false;
            for (let m = i + 1; m < j; m++) if (dev(pts[m], pts[i], pts[j]) > tol) return false;
            return true;
        };
        const out = [pts[0]];
        let i = 0;
        while (i < pts.length - 1) {
            let j = i + 1;
            while (j + 1 < pts.length && fits(i, j + 1)) j++;
            out.push(pts[j]);
            i = j;
        }
        return out;
    },

    overshoot(moves, steps = [1, 2, 3]) {
        // Points `steps` px past the last move, along the stroke's final
        // direction (taken over the last >= 2px, so jitter cannot skew it).
        const last = moves[moves.length - 1];
        for (let k = moves.length - 2; k >= 0; k--) {
            const dx = last.clientX - moves[k].clientX, dy = last.clientY - moves[k].clientY;
            const len = Math.hypot(dx, dy);
            if (len >= 2) return steps.map((d) => ({ clientX: last.clientX + (dx / len) * d, clientY: last.clientY + (dy / len) * d }));
        }
        return [];
    },

    interpolatePoints(points, step = 2) {
        const out = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const [x0, y0] = points[i - 1];
            const [x1, y1] = points[i];
            const dist = Math.hypot(x1 - x0, y1 - y0);
            const n = Math.max(1, Math.ceil(dist / step));
            for (let k = 1; k <= n; k++) {
                out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
            }
        }
        return out;
    },
});
