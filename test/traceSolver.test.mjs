import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, setRect } from "./helpers.mjs";

function challenge(page, info = {}) {
    page.window.testInfo = info;
    return page.run(`new DuolingoChallenge({ currentChallenge: window.testInfo })`);
}

test("trace pad: picks the largest svg inside the write challenge", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `
        <svg id="mascot"></svg>
        <div data-test="challenge challenge-characterWrite"><svg id="icon"></svg><svg id="pad"></svg></div>` });
    t.after(page.close);
    setRect(page.document.getElementById("mascot"), { width: 900, height: 900 });
    setRect(page.document.getElementById("icon"), { width: 100, height: 100 });
    setRect(page.document.getElementById("pad"), { width: 300, height: 300 });
    assert.equal(challenge(page).findTraceElement()?.id, "pad");
});

test("trace pad: never picks an svg outside the challenge", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<svg id="mascot"></svg>` });
    t.after(page.close);
    setRect(page.document.getElementById("mascot"), { width: 900, height: 900 });
    assert.equal(challenge(page).findTraceElement(), null);
});

test("trace pad: still found if Duolingo renames the challenge slightly", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `
        <div data-test="challenge challenge-characterWriteV2"><svg id="pad"></svg></div>` });
    t.after(page.close);
    setRect(page.document.getElementById("pad"), { width: 300, height: 300 });
    assert.equal(challenge(page).findTraceElement()?.id, "pad");
});

test("trace pad: falls back to the challenge container", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div id="root" data-test="challenge challenge-characterTrace"></div>` });
    t.after(page.close);
    setRect(page.document.getElementById("root"), { width: 300, height: 300 });
    assert.equal(challenge(page).findTraceElement()?.id, "root");
});

// Three strokes. Stroke 2 is pre-filled (no "guide" path). Stroke 1 is the
// highlighted one ("hl" overlay) and renders with slightly different numbers.
const STROKES = [
    { path: "M 10,10 C 20,20 30,30 40,40" },
    { path: "M 50,50 L 70,70 L 90,90" },
    { path: "M 15,80 C 25,85 35,85 45,80" },
];
const TRACE_HTML = `<div data-test="challenge challenge-characterWrite"><svg>
    <path class="grid" d="M 0,0 H 109 V 109 H 0 Z"></path>
    <path class="ghost" d="M 10,10  C 20,20 30,30 40,40"></path>
    <path class="ghost" d="M 50,50 L 70,70 L 90,90"></path>
    <path class="ghost" d="M 15,80 C 25,85 35,85 45,80"></path>
    <path class="guide" d="M 10,10 C 20,20 30,30 40,40"></path>
    <path class="guide" d="M 50.3,50.2 L 70,70 L 90,90"></path>
    <path class="hl" d="M 50.3,50.2 L 70,70 L 90,90"></path>
    <path class="ink" d="M 200,200 L 210,210"></path>
</svg></div>`;

test("trace: pre-filled strokes are the ones without a guide path", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: TRACE_HTML });
    t.after(page.close);
    assert.deepEqual([...challenge(page).doneStrokeIndices(STROKES)], [2]);
});

test("trace: rendered guides map to stroke indices, first path wins", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: TRACE_HTML });
    t.after(page.close);
    const guides = challenge(page).strokeGuides(STROKES);
    assert.deepEqual([...guides.keys()].sort(), [0, 1, 2]);
    assert.deepEqual([...guides.values()].map((g) => g.sig), ["ghost", "ghost", "ghost"]);
});

test("trace: guide path found exactly, or by nearest start point", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: TRACE_HTML });
    t.after(page.close);
    const c = challenge(page);
    assert.equal(c.findGuidePathEl(STROKES[0].path).getAttribute("class"), "ghost");
    assert.equal(c.findGuidePathEl("M 50.1,50.1 L 70,70 L 90,90").getAttribute("d"), "M 50,50 L 70,70 L 90,90");
    assert.equal(c.findGuidePathEl("M 300,300 L 310,310 L 320,320"), null);
});

test("trace: matchStrokeIndex", (t) => {
    const page = loadPage(LESSON_SCRIPTS);
    t.after(page.close);
    page.window.STROKES = STROKES;
    const match = (d) => page.run(`DuolingoChallenge.matchStrokeIndex(${JSON.stringify(d)}, window.STROKES)`);
    assert.equal(match("M 15,80  C 25,85 35,85 45,80 "), 2, "exact, whitespace ignored");
    assert.equal(match("M 50.3,50.2 L 70,70 L 90,90"), 1, "start point within 1px");
    assert.equal(match("M 0,0 H 109 V 109 H 0 Z"), -1, "grid line");
    assert.equal(match("M 200,200 L 210,210 L 220,220"), -1, "ink / unknown");
    assert.equal(match(null), -1);
});

// Run solveCharacterWrite with every DOM step stubbed. `active` is the
// sequence findActiveStrokeIndex returns, `accepted` what the ink check says.
async function runTraceLoop(t, { strokes, highlight, active, accepted = [] }) {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div id="pad"></div>` });
    t.after(page.close);
    const alerts = [];
    page.window.alert = (m) => alerts.push(m);
    const c = challenge(page, { strokes: strokes.map((_, k) => ({ path: `M ${k},0 L ${k},10` })) });
    const drawn = [];
    Object.assign(c, {
        findTraceElement: () => page.document.getElementById("pad"),
        waitForTraceReady: async () => true,
        doneStrokeIndices: () => new Set(),
        playerStatus: () => "GUESSING",
        snapshotStrokeSvg: () => "",
        waitForQuiescent: async () => {},
        dispatchStroke: async (_el, _pts, path) => drawn.push(Number(path.split(/[ ,]/)[1])),
        waitForStrokeAccepted: async () => accepted.shift() ?? true,
        findActiveStrokeIndex: (_s, _d, track) => {
            track.highlight = highlight;
            return active.shift() ?? -1;
        },
    });
    await c.solveCharacterWrite();
    return { drawn, alerts };
}

test("trace loop, highlight mode: follows the highlight until it vanishes", async (t) => {
    const r = await runTraceLoop(t, { strokes: [0, 1, 2], highlight: "hl", active: [0, 1, 2, -1] });
    assert.deepEqual(r, { drawn: [0, 1, 2], alerts: [] });
});

test("trace loop, highlight mode: stops after 3 strokes the highlight ignores", async (t) => {
    const r = await runTraceLoop(t, { strokes: [0, 1, 2], highlight: "hl", active: [0, 1, 1, 1, 1] });
    assert.deepEqual(r.drawn, [0, 1, 1, 1]);
    assert.equal(r.alerts.length, 1);
});

test("trace loop, order mode: stops after 3 rejects in a row", async (t) => {
    const r = await runTraceLoop(t, { strokes: [0, 1, 2, 3], highlight: null, active: [0, 1, 2, 3, -1], accepted: [true, false, false, false] });
    assert.deepEqual(r.drawn, [0, 1, 2, 3]);
    assert.equal(r.alerts.length, 1);
});

test("trace loop, order mode: an accepted stroke resets the reject count", async (t) => {
    const r = await runTraceLoop(t, { strokes: [0, 1, 2, 3, 4], highlight: null, active: [0, 1, 2, 3, 4, -1], accepted: [false, false, true, false, false] });
    assert.deepEqual(r, { drawn: [0, 1, 2, 3, 4], alerts: [] });
});

// Real characterWrite state for 马: stroke 0 is PREDRAWN ink ("_1vFJk"),
// stroke 1 is the target ("_22UPm"), stroke 2 is not rendered yet. Both
// classes sit on one stroke each; the ink must not win as the highlight.
const MA_STROKES = [
    { path: "M 29.54,18.60 C 31.72,18.48,64.15,14.40,66.28,14.40 C 69.39,14.40,70.95,16.38,70.65,18.33 C 70.47,19.51,68.31,27.62,65.99,41.38", strokeDrawMode: "PREDRAWN" },
    { path: "M 31.75,18.98 C 32.20,19.42,32.69,21.74,32.69,22.47 C 32.64,29.80,32.51,59.02,32.16,57.08 C 46.49,55.15,76.82,52.34,84.76,51.75 C 89.92,51.37,92.16,52.70,91.60,57.04 C 89.67,72.29,85.51,83.51,82.27,89.56 C 76.65,100.06,74.25,96.13,69.03,90.03", strokeDrawMode: "FREEHAND" },
    { path: "M 20.55,73.86 C 34.36,72.96,66.68,70.31,72.61,69.75 C 74.70,69.57,78.21,69.39,79.27,69.64", strokeDrawMode: "FREEHAND" },
];
const MA_HTML = `<div data-test="challenge challenge-characterWrite"><div class="_2GkiA"><svg viewBox="0 0 307 307">
    <path class="cNV1w" d="M 0 153.5 H 307"></path>
    <path class="cNV1w" d="M 153.5 0 V 307"></path>
    <g><path class="_1vFJk" d="${MA_STROKES[0].path}" pathLength="1"></path><path class="_22UPm" d="${MA_STROKES[1].path}"></path></g>
    <path class="_1vFJk" d="" pathLength="1"></path>
</svg></div></div>`;

test("write: PREDRAWN ink is never the highlight", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: MA_HTML });
    t.after(page.close);
    const c = challenge(page, { strokes: MA_STROKES });
    const preDone = c.doneStrokeIndices(MA_STROKES);
    assert.ok(preDone.has(0), "stroke 0 is pre-drawn");
    const track = {};
    assert.equal(c.findActiveStrokeIndex(MA_STROKES, new Set(), track, preDone), 1);
    assert.equal(track.highlight, "_22UPm");
});
