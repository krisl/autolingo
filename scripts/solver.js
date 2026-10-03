class DuolingoChallenge {
    constructor(pageData) {
        this.challengeInfo = pageData.currentChallenge;
        this.challengeToggleState = pageData.challengeToggleState
    }

    get isKeyboardEnabled() {
        // Parent object contains several information about current duolingo status;
        const pageData = window.getReactElement(document.querySelector("._3yE3H"))?.return?.return?.memoizedProps;
        let parentObject = pageData.challengeToggleState;
        const result = (parentObject.isToggledToTyping)
        window.console.logger({isKeyboardEnabled: result})
        return result
    }

    static getElementsByDataTest(dataTest, parent = window.document) {
        return Array.from(parent.querySelectorAll(`[data-test="${dataTest}"]`));
    }

    printDebugInfo() {
        window.console.logger("challengeType: " + this.challengeInfo.type);
        window.console.logger(this.challengeInfo);
        const tts = this.challengeInfo.solutionTts
        if (tts) {
          window.console.logger('tts', tts);
        }
    }

    extractTextFromNodes(nodes) {
        // From an array with nodes, it tries to get extract the user displayed in screen text.
        // Then, it returns an object with the text as the key and the node as the value.

        return Object.fromEntries(nodes.map((node) => {
            let rubyNode = node.querySelector("ruby");
            let nodeText = "";

            if (rubyNode) {
                nodeText = Array.from(rubyNode.querySelectorAll("span")).map((e) => e.textContent).join("");
            } else {
                let textOptionOne = this.constructor.getElementsByDataTest("challenge-tap-token-text", node)[0]?.textContent;
                let textOptionTwo = node.querySelector("[lang]")?.textContent;
                nodeText = textOptionOne ?? textOptionTwo;
            }

            return [nodeText, node];
        }));
    }

    // Methods for simulating user interaction.
    static clickButtonCheck() {
        this.getElementsByDataTest("player-next")[0].click();
    }

    static clickButtonContinue() {
        this.getElementsByDataTest("player-next")[0].click();
    }

    static clickButtonSkip() {
        this.getElementsByDataTest("player-skip")[0].click();
    }

    static insertText(textFieldDataTest, value) {
        let fieldText = this.getElementsByDataTest(textFieldDataTest)[0];
        window.getReactElement(fieldText)?.pendingProps?.onChange({ target: { value } });
    }

    // Methods for solving the problems.
    get_async_solver() {
        switch (this.challengeInfo.type) {
            case "dialogue":
            case "readComprehension":
            case "characterIntro":
            case "characterSelect":
            case "selectPronunciation":
            case "select":
            case "assist":
            case "gapFill":
            case "reverseAssist":
            case "transliterationAssist":
                return () => this.solveSelectCorrectIndexTypeProblems();

            case "characterMatch":
            case "match":
                return () => this.solveCharacterMatch();
            
            case "read_comprehension":
            case "translate":
            case "listenTap":
            case "name":
                return () => this.isKeyboardEnabled ? this.solveWriteTextInSomeTextFieldTypeProblems() : this.solveTapTextTypeProblems();

            case "transliterate":
                return () => this.solveWriteTextInSomeTextFieldTypeProblems();

            case "tapComplete":
                return () => this.solveTapTextTypeProblems();

            case "svgPuzzle":
                return () => this.solveSvgPuzzle();

            case "characterTrace":
            case "characterWrite":
                return () => this.solveCharacterWrite();

            case "listenComprehension":
            case "listenIsolation":
                return () => this.solveListenIsolation();

            case "listen":
                return () => this.writeTextInSpace();

            case "listenComplete":
                return () => this.solveFromNearbyElements();
            case "completeReverseTranslation":
                return () => this.isKeyboardEnabled ? this.solveWriteTextInSomeTextFieldTypeProblems() : this.solveFromNearbyElements();
            case "partialReverseTranslate":
                return () => this.solveFromNearbyElementsButForPartialReverseTranslate();

            //TODO: This is only commented because I don't have any problem to test it with
            // case "typeCloze":
            //     this.solveFromNearbyElementsButForTypeCloze();
            //     break;
        }
    }
    solveFromNearbyElementsButForPartialReverseTranslate() {
        const altCorrectAnswer = this.challengeInfo.displayTokens.filter(dt => dt.isBlank).map(dt => dt.text).join('')
        const correctAnswer = parent.document.querySelector(".Id-Wa").textContent
        window.console.logger({altCorrectAnswer, correctAnswer})
        window.console.logger(altCorrectAnswer === correctAnswer)

        const altInputElement = window.document.querySelector("[data-test='challenge challenge-partialReverseTranslate'] [contenteditable=true]")
        let inputElement = parent.document.querySelector(".tapBI");

        window.console.logger({altInputElement, inputElement})
        window.console.logger(altInputElement === inputElement)

        inputElement.textContent = correctAnswer;
    
        // Create a new 'input' event
        let event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
    
        // Dispatch the event
        inputElement.dispatchEvent(event);
    }

    solveFromNearbyElementsButForTypeCloze() {
        let correctAnswer = parent.document.querySelector(".caPDQ").textContent
        //remove first character
        correctAnswer = correctAnswer.substring(1, correctAnswer.length);
        let inputElement = parent.document.querySelector(".Y5JxA._17nEt");
        inputElement.textContent = correctAnswer;

        // Create a new 'input' event
        let event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });

        // Dispatch the event
        inputElement.dispatchEvent(event);
    } 

    solveFromNearbyElements() {
        const correctAnswer = this.challengeInfo.displayTokens.find(dt => dt.isBlank).text

        let textField = this.constructor.getElementsByDataTest("challenge-text-input")[0];
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: correctAnswer } });
        console.logger({textField})
        window.setTimeout(() => {
            const parent = textField.parentNode.parentNode.parentNode
            parent.innerHTML = `<textarea class="_2OQj6 _3zGeZ _394fY RpiVp" disabled>${this.challengeInfo.challengeResponseTrackingProperties.best_solution}</textarea>`
        }, 1);
    }

    async solveListenIsolation() {
        const buttons = parent.document.querySelectorAll(".ufykF");
        buttons[this.challengeInfo.correctIndex].click();
        await sleep();
    }

    writeTextInSpace() {
        let bestSolution = this.challengeInfo.challengeResponseTrackingProperties.best_solution;
        let textField = this.constructor.getElementsByDataTest("challenge-translate-input")[0];
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: bestSolution } });
    }

    async solveSelectCorrectIndexTypeProblems() {
        // This method clicks the correct button from an array of possible buttons.
        // It uses the "data-test" attribute to identify possible buttons.
        const dataTestByChallengeType = {
            "characterIntro": "challenge-judge-text",
            "characterSelect": "challenge-choice",
            "selectPronunciation": "challenge-choice",
            "select": "challenge-choice",
            "assist": "challenge-choice",
            "gapFill": "challenge-choice",
            "dialogue": "challenge-choice",
            "readComprehension": "challenge-choice",
            "reverseAssist": "challenge-choice",
            "transliterationAssist": "challenge-choice"
        }

        let correctIndex = this.challengeInfo.correctIndex;
        let dataTest = dataTestByChallengeType[this.challengeInfo.type];
        this.constructor.getElementsByDataTest(dataTest)[correctIndex].click();
        await sleep();
    }
    
    async solveCorrectIndicesTypeProblems(){
        let solutions = this.challengeInfo.correctIndices;
        let wordBank = this.constructor.getElementsByDataTest("word-bank")[0];
        let options = this.constructor.getElementsByDataTest("challenge-tap-token-text", wordBank);
        for (let i = 0; i < solutions.length; i++){
            options[solutions[i]].click();
            await sleep();
        }
    }

    solveWriteTextInSomeTextFieldTypeProblems() {
        // This method inserts a text inside some valid text field.
        // It uses "data-test" attribute to identify the text field.

        let specificTypeProblem = this.challengeInfo.challengeGeneratorIdentifier.specificType;
        let solution = (() => {
            switch (specificTypeProblem) {
                case "tap":
                case "listen_tap":
                    return this.challengeInfo.prompt;

                case "reverse_tap":
                case "reverse_translate":
                case "transliterate":
                case "translate":
                case "name":
                    return this.challengeInfo.correctSolutions[0];

                case "complete_reverse_translation":
                    return this.challengeInfo.challengeResponseTrackingProperties.best_solution;

                default:
                    alert("Unknown translate problem type: " + this.specificTranslateType);
                    throw new Error(this.specificTranslateType);
            }
        })();

        window.console.logger({solution, tts: this.challengeInfo.solutionTts});
        const dataTextByChallengeType = {
            "translate": "challenge-translate-input",
            "listenTap": "challenge-translate-input",
            "transliterate": "challenge-text-input",
            "name": "challenge-text-input",
            "type": "challenge-text-input",
            "completeReverseTranslation": "challenge-translate-input"
        }

        const dataTest = dataTextByChallengeType[this.challengeInfo.type];
  	if (!dataTest) {
            console.logger(`couldnt obtain data-test attribute for challenge info type '${this.challengeInfo.type}'`)
            return
        }
        this.constructor.insertText(dataTest, solution);
        const tts = this.challengeInfo.solutionTts
        // curl -v https://translate.googleapis.com/translate_tts\?client\=gtx\&ie-UTF-8\&tl\=it\&q\=ciao
        if (tts) {
            const howl = new Howl({ html5: true, src: tts })
            howl.play()
        }
    }

    async solveTapTextTypeProblems() {
        // This method clicks the correct button from an array of possible buttons in the order required.
        // It uses the "._3CBig" class to identify possible buttons.

        const specificTypeProblem = this.challengeInfo.challengeGeneratorIdentifier.specificType;
        const targetLanguage = this.challengeInfo.targetLanguage
        console.logger({targetLanguage, specificTypeProblem})
        let correctTokens = this.challengeInfo.correctTokens ?? this.challengeInfo.prompt?.split("") ?? this.challengeInfo.correctIndices.map(i => this.challengeInfo.choices[i].text);
        let wordBank = this.constructor.getElementsByDataTest("word-bank")[0];
        let buttonUnpressedClasses = wordBank.querySelector("button").classList.toString();
        const allPossibleButtons = Array.from(wordBank.querySelectorAll("button"));
        console.logger({allPossibleButtons, correctTokens})
        for (let token of correctTokens) {
            const avaibleButtons = allPossibleButtons.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            const tokensText = this.extractTextFromNodes(avaibleButtons);
            console.logger({avaibleButtons, tokensText})
            tokensText[token].click();
            if (['tap_gap', 'reverse_tap', 'listen_tap'].includes(specificTypeProblem)) {
                console.logger("H", Howler._howls)
                await sleep(200);
                const howl = Howler._howls.find(obj => obj.playing())
                if (howl) {
                    const duration = howl.duration()
                    const currentPos = howl.seek()
                    const remainingSeconds = duration - currentPos 
                    console.logger("playing audio", {duration, currentPos, remainingSeconds})
                    const silence = ['it', 'zh', 'fr'].includes(this.challengeInfo.targetLanguage) ? 900 : 200
                    await sleep(Math.max(200, (remainingSeconds * 1000) - silence));
                } else {
                    console.logger("Nothingn playing")
                    await sleep(1000);
                }
            }
        }
    }

    async solveSvgPuzzle() {
        // svgPuzzle (e.g. Chinese 裙 = 衤 + 尹 + ...): tap radical pieces
        // in correctIndices order. Buttons carry data-test="{text}-challenge-tap-token".
        for (const idx of this.challengeInfo.correctIndices) {
            const text = this.challengeInfo.choices[idx]?.text;
            if (text == null) continue;
            let btn = document.querySelector(`[data-test="${text}-challenge-tap-token"]`);
            if (!btn) {
                // Fallback: match by visible text among tap-token buttons.
                const cands = Array.from(document.querySelectorAll('[data-test$="challenge-tap-token"]'));
                btn = cands.find((b) => (b.textContent ?? "").includes(text));
            }
            window.console.logger({ svgPuzzleTap: text, found: !!btn });
            btn?.click();
            await sleep(300);
        }
    }

    async solveCharacterMatch() {
        // This method clicks the correct button from two arrays of possible buttons in the order required.
        // It uses the "._33Jbm" class to identify possible buttons.x
        let optionsContainer = document.querySelector("div[data-test*='challenge'] > div > div > div");
        let buttonUnpressedClasses = optionsContainer.querySelector("button").classList.toString();

        let solutionPairs = this.challengeInfo.pairs;
        for (let pair of solutionPairs) {
            let allOptionsNodes = Array.from(optionsContainer.querySelectorAll("span"));
            let optionNodes = allOptionsNodes.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            let pairsNodeText = this.extractTextFromNodes(optionNodes);

            pairsNodeText[pair.fromToken ?? pair.transliteration].click();
            await sleep();
            pairsNodeText[pair.learningToken ?? pair.character].click();
            await sleep();
        }
    }

    async solveCharacterWrite() {
        // characterWrite / characterTrace (e.g. Chinese hanzi): challengeInfo.strokes
        // contains SVG paths in a width x height box (e.g. 109x109).
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

        // 1. Try React-level bypass: many trace components expose onComplete/onPass.
        if (this.tryReactTraceBypass(traceEl)) {
            await sleep(500);
            return;
        }

        // 2. Replay strokes synthetically. Re-detect the quiz's active stroke
        // before every draw and stop when nothing remains: extra strokes
        // after completion count as mistakes (BLAMING). Single attempt per
        // stroke; abort after 3 consecutive rejects to save hearts.
        const drawn = new Set();
        const track = { highlight: undefined }; // undefined=undetected, null=order mode, string=highlight class
        let i = this.findActiveStrokeIndex(strokes, drawn, track);
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
            await this.dispatchStroke(traceEl, points, strokes[i].path, 4);
            drawn.add(i);
            await this.waitForStrokeAccepted(traceEl, i, before);
            const next = this.findActiveStrokeIndex(strokes, drawn, track);
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
            }
            i = next;
        }
    }

    findTraceElement() {
        // Prefer explicit write/trace pads over generic characterIntro cards.
        const selectors = [
            "[data-test='challenge challenge-characterWrite'] canvas",
            "[data-test='challenge challenge-characterWrite'] svg",
            "[data-test='challenge challenge-characterTrace'] canvas",
            "[data-test='challenge challenge-characterTrace'] svg",
            "[data-test*='characterWrite']",
            "[data-test*='characterTrace']",
            "[data-test*='trace']",
            "[data-test*='write']",
            "canvas",
            "svg",
        ];
        for (const sel of selectors) {
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
    }

    tryReactTraceBypass(traceEl) {
        // Walk up a few levels looking for a React prop that marks the trace done.
        let el = traceEl;
        for (let depth = 0; depth < 6 && el; depth++) {
            const fiber = window.getReactElement(el);
            const props = fiber?.pendingProps ?? fiber?.memoizedProps ?? {};
            for (const key of Object.keys(props)) {
                if (/complete|pass|success|correct|done|nextStroke|onTrace/i.test(key) && typeof props[key] === "function") {
                    window.console.logger({ reactBypassCandidate: key, depth });
                    try {
                        props[key]();
                        // If it didn't throw, assume it helped; drawing will finish the rest.
                    } catch (e) {
                        window.console.logger({ reactBypassFailed: key, e: String(e) });
                    }
                }
            }
            el = el.parentElement;
        }
        return false; // never fully trust bypass; always draw afterwards
    }

    static parseSvgPathToPoints(path, samplesPerCurve = 16) {
        // Sample ON-curve points (old code dragged through cubic control
        // points, which lie off the curve and trip GUARDRAIL).
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
            // pairs may be "x,y" (matched as " x" + "y") or "x y"
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
    }

    strokeSvgRoot() {
        return (
            document.querySelector("[data-test='challenge challenge-characterWrite'] ._2GkiA svg") ??
            document.querySelector("[data-test='challenge challenge-characterTrace'] ._2GkiA svg")
        );
    }

    playerStatus() {
        try {
            const el = document.querySelector("._3yE3H");
            const pd = el && window.getReactElement(el)?.return?.return?.memoizedProps;
            return pd?.player?.status ?? null;
        } catch (e) {
            return null;
        }
    }

    findActiveStrokeIndex(strokes, drawn = new Set(), track = {}) {
        // Two modes, decided once per challenge:
        // - highlight mode: some guide has a singleton class (the highlighted
        //   active stroke). Follow it: draw its stroke; when it moves, draw
        //   the next; when it vanishes, the trace is complete (-1).
        // - order mode: all guides look the same (fresh char). Draw smallest
        //   undrawn index (stroke order) until status/disconnect stops us.
        // Never redraws a drawn stroke. Returns -1 when nothing remains.
        try {
            const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
            const strokeDs = strokes.map((s) => norm(s.path));
            const svg = this.strokeSvgRoot();
            const scope = svg ?? document.querySelector("[data-test='challenge challenge-characterWrite'], [data-test='challenge challenge-characterTrace']") ?? document;
            const seen = new Map(); // strokeIdx -> {sig}
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
                if (!seen.has(idx)) seen.set(idx, { sig: `${p.getAttribute("class")}` });
            }
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
                const hits = [...seen.entries()]
                    .filter(([idx, { sig }]) => sig === track.highlight && !drawn.has(idx))
                    .map(([idx]) => idx)
                    .sort((a, b) => a - b);
                return hits.length ? hits[0] : -1;
            }
            for (let k = 0; k < strokes.length; k++) {
                if (!drawn.has(k)) return k;
            }
            return -1;
        } catch (e) {
            window.console.logger({ activeDetectFailed: String(e) });
            return drawn.size > 0 ? -1 : 0;
        }
    }

    snapshotGuides() {
        const svg = this.strokeSvgRoot();
        const scope = svg ?? document.querySelector("[data-test='challenge challenge-characterWrite'], [data-test='challenge challenge-characterTrace']");
        if (!scope) return "";
        return Array.from(scope.querySelectorAll("path"))
            .map((p) => `${p.getAttribute("class")}|${p.style?.opacity}|${p.getAttribute("stroke-opacity")}|${p.getAttribute("stroke-dashoffset")}`)
            .join(";");
    }

    snapshotStrokeSvg() {
        const svg = this.strokeSvgRoot();
        const scope = svg ?? document.querySelector("[data-test='challenge challenge-characterWrite'], [data-test='challenge challenge-characterTrace']");
        if (!scope) return "";
        return Array.from(scope.querySelectorAll("path"))
            .map((p) => `${p.getAttribute("class")}|${p.getAttribute("d")?.length}`)
            .join(";");
    }

    async waitForStrokeAccepted(traceEl, idx, before) {
        // Snapshot was taken BEFORE drawing; poll up to 2s for any change
        // (ink appears during validation, which can lag pointer events).
        for (let t = 0; t < 2000; t += 250) {
            await sleep(250);
            const after = this.snapshotStrokeSvg();
            if (after !== before) {
                window.console.logger({ strokeAcceptedPoll: idx, accepted: true });
                return true;
            }
        }
        window.console.logger({ strokeAcceptedPoll: idx, accepted: false });
        return false;
    }

    findGuidePathEl(strokePath) {
        // Rendered guide <path d="..."> should equal challengeInfo path.
        // Match exactly (whitespace-insensitive) to sample true screen coords.
        const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
        const want = norm(strokePath);
        const root = document.querySelector("[data-test='challenge challenge-characterWrite'], [data-test='challenge challenge-characterTrace']") ?? document;
        const paths = Array.from(root.querySelectorAll("svg path"));
        for (const p of paths) {
            if (norm(p.getAttribute("d")) === want) return p;
        }
        // Fallback: same start point (first "M x,y").
        const start = (want.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/) ?? [null])[0];
        if (start) {
            for (const p of paths) {
                if ((norm(p.getAttribute("d")) ?? "").includes(start)) return p;
            }
        }
        return null;
    }

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
    }

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
        await sleep(60);
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
    }

    static interpolatePoints(points, step = 2) {
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
    }
}
