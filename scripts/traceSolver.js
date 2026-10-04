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
        // after completion count as mistakes (BLAMING). Single attempt per
        // stroke; abort after 3 consecutive rejects to save hearts.
        const drawn = new Set();
        const track = { highlight: undefined }; // undefined=undetected, null=order mode, string=highlight class
        const preDone = this.doneStrokeIndices(strokes);
        window.console.logger({ preDone: [...preDone] });
        let i = this.findActiveStrokeIndex(strokes, drawn, track, preDone);
        window.console.logger({ startIdx: i });
        let rejects = 0;
        while (i >= 0 && i < strokes.length && drawn.size < strokes.length) {
            if (!traceEl.isConnected) return;
            const st = this.playerStatus();
            if (st && st !== "GUESSING") {
                window.console.logger({ stopOnStatus: st });
                return;
            }
            const before = this.snapshotStrokeSvg();
            const points = this.constructor.parseSvgPathToPoints(strokes[i].path, 24);
            await this.dispatchStroke(traceEl, points, strokes[i].path, 2);
            drawn.add(i);
            const accepted = await this.waitForStrokeAccepted(traceEl, i, before);
            // Let validation animations finish: starting the next stroke
            // while the quiz is still settling gets it silently ignored.
            await this.waitForQuiescent();
            const next = this.findActiveStrokeIndex(strokes, drawn, track, preDone);
            if (track.highlight) {
                // Highlight must move (or vanish = complete). Unmoved = invalid stroke.
                if (next === i) {
                    rejects++;
                    window.console.logger({ rejected: i, rejects });
                    if (rejects >= 3) {
                        alert("Autolingo: stopping trace early (3 strokes not accepted) to save hearts. Finish manually, then Solve again.");
                        return;
                    }
                } else {
                    rejects = 0;
                }
                if (next < 0) {
                    window.console.logger({ traceComplete: true });
                    return;
                }
            } else if (!accepted) {
                rejects++;
                window.console.logger({ rejected: i, rejects });
                if (rejects >= 3) {
                    alert("Autolingo: stopping trace early (3 strokes not accepted) to save hearts. Finish manually, then Solve again.");
                    return;
                }
            } else {
                rejects = 0;
            }
            i = next;
        }
    },

    findTraceElement() {
        // Prefer explicit write/trace pads over generic characterIntro cards.
        // Selectors live in SELECTORS.tracePad (scripts/selectors.js).
        for (const sel of SELECTORS.tracePad) {
            const els = Array.from(document.querySelectorAll(sel));
            // Prefer the largest visible element (the trace pad, not icons).
            const visible = els.filter((e) => {
                const r = e.getBoundingClientRect?.();
                return r && r.width > 80 && r.height > 80;
            });
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
        return null;
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
        // Redrawing done strokes counts as a mistake, so skip them.
        const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
        const strokeDs = strokes.map((s) => norm(s.path));
        const classSets = strokes.map(() => new Set());
        const svg = this.strokeSvgRoot();
        const scope = svg ?? queryFirst(SELECTORS.challengeRoot) ?? document;
        for (const p of Array.from(scope.querySelectorAll("svg path, path"))) {
            const d = norm(p.getAttribute("d"));
            if (d.length <= 20 || /[HVhv]/.test(d)) continue; // grid lines
            let idx = strokeDs.indexOf(d);
            if (idx < 0) {
                // Start-point fallback (numeric precision can differ).
                const m = d.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
                if (!m) continue;
                const [ax, ay] = m[0].split(",").map(Number);
                idx = strokes.findIndex((s) => {
                    const sm = norm(s.path).match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
                    if (!sm) return false;
                    const [sx, sy] = sm[0].split(",").map(Number);
                    return Math.hypot(ax - sx, ay - sy) < 1.0;
                });
                if (idx < 0) continue; // ink or unknown path
            }
            classSets[idx].add(`${p.getAttribute("class")}`);
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
        const done = new Set();
        if (guideClass) {
            classSets.forEach((set, i) => { if (!set.has(guideClass)) done.add(i); });
        }
        return done;
    },

    strokeGuides(strokes) {
        // Rendered guide paths mapped to strokes[] indices (excludes grid + ink).
        // Returns Map strokeIdx -> {sig, el}.
        const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
        const strokeDs = strokes.map((s) => norm(s.path));
        const svg = this.strokeSvgRoot();
        const scope = svg ?? queryFirst(SELECTORS.challengeRoot) ?? document;
        const seen = new Map();
        for (const p of Array.from(scope.querySelectorAll("svg path, path"))) {
            const d = norm(p.getAttribute("d"));
            if (d.length <= 20 || /[HVhv]/.test(d)) continue; // grid lines
            let idx = strokeDs.indexOf(d);
            if (idx < 0) {
                // Start-point fallback (numeric precision can differ).
                const m = d.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
                if (!m) continue;
                const [ax, ay] = m[0].split(",").map(Number);
                idx = strokes.findIndex((s) => {
                    const sm = norm(s.path).match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
                    if (!sm) return false;
                    const [sx, sy] = sm[0].split(",").map(Number);
                    return Math.hypot(ax - sx, ay - sy) < 1.0;
                });
                if (idx < 0) continue; // ink or unknown path
            }
            if (!seen.has(idx)) seen.set(idx, { sig: `${p.getAttribute("class")}`, el: p });
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
        try {
            const pd = window.getReactElement(queryFirst(SELECTORS.lessonRoot, window.document, true))?.return?.return?.memoizedProps;
            return pd?.player?.status ?? null;
        } catch (e) {
            return null;
        }
    },

    findActiveStrokeIndex(strokes, drawn = new Set(), track = {}, preDone = new Set()) {
        // Two modes, decided once per challenge:
        // - highlight mode: some guide has a singleton class (the highlighted
        //   active stroke). Follow it: draw its stroke; when it moves, draw
        //   the next; when it vanishes, the trace is complete (-1).
        // - order mode: all guides look the same (fresh char). Draw smallest
        //   undrawn index (stroke order) until status/disconnect stops us.
        // Never redraws a drawn stroke. Returns -1 when nothing remains.
        try {
            const seen = this.strokeGuides(strokes);
            const counts = {};
            for (const { sig } of seen.values()) counts[sig] = (counts[sig] ?? 0) + 1;
            window.console.logger({ guideClasses: Object.entries(counts), guideCount: seen.size });
            if (track.highlight === undefined) {
                const bySig = {};
                for (const [idx, { sig }] of seen) (bySig[sig] ??= []).push(idx);
                const singles = Object.entries(bySig).filter(([, a]) => a.length === 1);
                singles.sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
                track.highlight = singles.length ? singles[0][0] : null;
                window.console.logger({ highlightMode: track.highlight });
            }
            if (track.highlight) {
                // Highlighted stroke is by definition not done; preDone only
                // gates order mode below.
                const hits = [...seen.entries()]
                    .filter(([idx, { sig }]) => sig === track.highlight && !drawn.has(idx))
                    .map(([idx]) => idx)
                    .sort((a, b) => a - b);
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

    async waitForStrokeAccepted(traceEl, idx, before) {
        // Snapshot was taken BEFORE drawing; poll for any change (ink
        // appears during validation, which can lag pointer events).
        for (let t = 0; t < 1200; t += 150) {
            await sleep(150);
            const after = this.snapshotStrokeSvg();
            if (after !== before) {
                window.console.logger({ strokeAcceptedPoll: idx, accepted: true });
                return true;
            }
        }
        window.console.logger({ strokeAcceptedPoll: idx, accepted: false });
        return false;
    },

    async waitForQuiescent(timeout = 1500) {
        // Validation animations settle asynchronously; the next stroke's
        // pointerdown landing mid-animation is silently ignored.
        let prev = this.snapshotStrokeSvg();
        const t0 = Date.now();
        while (Date.now() - t0 < timeout) {
            await sleep(150);
            const cur = this.snapshotStrokeSvg();
            if (cur === prev) return;
            prev = cur;
        }
    },

    findGuidePathEl(strokePath) {
        // Rendered guide <path d="..."> should equal challengeInfo path.
        // Match exactly (whitespace-insensitive) to sample true screen coords.
        const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
        const want = norm(strokePath);
        const root = queryFirst(SELECTORS.challengeRoot) ?? document;
        const paths = Array.from(root.querySelectorAll("svg path"));
        for (const p of paths) {
            if (norm(p.getAttribute("d")) === want) return p;
        }
        // Fallback: same start point, compared NUMERICALLY (substring
        // matching can grab a similar-but-wrong stroke's path).
        const wantStart = (want.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/) ?? [null])[0];
        if (wantStart) {
            const [wx, wy] = wantStart.split(",").map(Number);
            let best = null, bestDist = 1.0;
            for (const p of paths) {
                const m = (norm(p.getAttribute("d")) ?? "").match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/);
                if (!m) continue;
                const [px, py] = m[0].split(",").map(Number);
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

    sampleGuidePathClientCoords(guideEl, n = 60) {
        try {
            const len = guideEl.getTotalLength();
            const ctm = guideEl.getScreenCTM();
            if (!len || !ctm) return null;
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

    async dispatchStroke(traceEl, points, strokePath = null, stepMs = 8) {
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
            const sampled = guideEl ? this.sampleGuidePathClientCoords(guideEl, 36) : null;
            if (sampled?.length) {
                moves = sampled;
                guideUsed = true;
            }
        }
        if (!moves) {
            // Fallback: dense box-math polyline (~2px steps).
            const dense = this.constructor.interpolatePoints(points, 2);
            moves = [toClient(dense[0]), ...dense.slice(1).map(toClient)];
        }
        const first = moves[0];
        window.console.logger({ guideUsed, movePoints: moves.length });

        const innerTarget = traceEl.querySelector("canvas, svg") ?? traceEl;
        // The element under the point may differ from the container (overlay divs).
        const elAtFirst = document.elementFromPoint(first.clientX, first.clientY) ?? innerTarget;
        const targets = [...new Set([elAtFirst, innerTarget, traceEl, document])];
        const opts = (p) => ({ bubbles: true, cancelable: true, composed: true, ...p });
        const safeDispatch = (el, evt) => {
            try { el.dispatchEvent(evt); } catch (e) { window.console.logger({ dispatchFailed: evt.type, e: String(e) }); }
        };
        const fireAll = (makeEvt) => targets.forEach((t) => safeDispatch(t, makeEvt()));
        const makeTouch = (c, id = 1) => {
            try {
                return new Touch({ identifier: id, target: innerTarget, clientX: c.clientX, clientY: c.clientY });
            } catch (e) {
                return null;
            }
        };

        fireAll(() => new PointerEvent("pointerover", opts({ ...first, pointerId: 1, isPrimary: true, pointerType: "touch" })));
        // Hover to the start point first (no buttons): mimics aiming and
        // avoids the teleport from the previous stroke-end counting as ink.
        fireAll(() => new PointerEvent("pointermove", opts({ ...first, pointerId: 1, isPrimary: true, pointerType: "touch", buttons: 0, pressure: 0 })));
        fireAll(() => new MouseEvent("mousemove", opts({ ...first, buttons: 0 })));
        await sleep(20);
        fireAll(() => new PointerEvent("pointerdown", opts({ ...first, pointerId: 1, isPrimary: true, pointerType: "touch", buttons: 1, pressure: 0.5 })));
        fireAll(() => new MouseEvent("mousedown", opts({ ...first, buttons: 1 })));
        const t0 = makeTouch(first);
        if (t0) fireAll(() => new TouchEvent("touchstart", opts({ touches: [t0], targetTouches: [t0], changedTouches: [t0] })));

        let prev = first;
        for (const c of moves.slice(1)) {
            const moveInit = { ...c, pointerId: 1, isPrimary: true, pointerType: "touch", buttons: 1, pressure: 0.5, movementX: c.clientX - prev.clientX, movementY: c.clientY - prev.clientY };
            fireAll(() => new PointerEvent("pointermove", opts(moveInit)));
            fireAll(() => new MouseEvent("mousemove", opts({ ...c, buttons: 1 })));
            const tm = makeTouch(c);
            if (tm) fireAll(() => new TouchEvent("touchmove", opts({ touches: [tm], targetTouches: [tm], changedTouches: [tm] })));
            prev = c;
            await sleep(stepMs);
        }

        const last = moves[moves.length - 1];
        fireAll(() => new PointerEvent("pointerup", opts({ ...last, pointerId: 1, isPrimary: true, pointerType: "touch", buttons: 0, pressure: 0 })));
        fireAll(() => new MouseEvent("mouseup", opts({ ...last, buttons: 0 })));
        const t1 = makeTouch(last);
        if (t1) fireAll(() => new TouchEvent("touchend", opts({ touches: [], targetTouches: [], changedTouches: [t1] })));
        window.console.logger({ strokeDrawn: moves.length });
    },
});

Object.assign(DuolingoChallenge, {

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
