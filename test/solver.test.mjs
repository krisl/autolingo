import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, setFiber, tick } from "./helpers.mjs";

function challenge(page, info) {
    page.window.testInfo = info;
    return page.run(`new DuolingoChallenge({ currentChallenge: window.testInfo })`);
}

test("listenComplete shows the best solution as text, not HTML", async (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div id="box"><div><div><input data-test="challenge-text-input"></div></div></div>` });
    t.after(page.close);
    const typed = [];
    setFiber(page.document.querySelector("input"), { pendingProps: { onChange: (e) => typed.push(e.target.value) } });
    const best = `a < b</textarea><img src="x">`;
    challenge(page, {
        type: "listenComplete",
        displayTokens: [{ text: "a" }, { text: "word", isBlank: true }],
        challengeResponseTrackingProperties: { best_solution: best },
    }).solveFillBlank();
    await tick(5);

    assert.deepEqual(typed, ["word"]);
    const box = page.document.getElementById("box");
    assert.equal(box.querySelector("img"), null);
    assert.equal(box.querySelector("textarea").value, best);
    assert.equal(box.querySelector("textarea").disabled, true);
});

test("typed answer still goes in when Duolingo's Howl audio global is missing", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<textarea data-test="challenge-translate-input"></textarea>` });
    t.after(page.close);
    const typed = [];
    setFiber(page.document.querySelector("textarea"), { pendingProps: { onChange: (e) => typed.push(e.target.value) } });
    const c = challenge(page, {
        type: "translate",
        challengeGeneratorIdentifier: { specificType: "translate" },
        correctSolutions: ["ciao"],
        solutionTts: "https://example.invalid/tts.mp3",
    });
    assert.doesNotThrow(() => c.solveByTyping());
    assert.deepEqual(typed, ["ciao"]);
});

test("tap answer still goes in when Duolingo's Howler global is missing", async (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div data-test="word-bank">
        <button class="tile"><span data-test="challenge-tap-token-text">ciao</span></button></div>` });
    t.after(page.close);
    page.run(`window.sleep = () => Promise.resolve()`);
    let clicks = 0;
    page.document.querySelector("button").addEventListener("click", () => clicks++);
    await challenge(page, {
        type: "listenTap",
        challengeGeneratorIdentifier: { specificType: "listen_tap" },
        correctTokens: ["ciao"],
    }).solveByTapping();
    assert.equal(clicks, 1);
});

for (const [type, expected] of [["characterIntro", "judge-1"], ["select", "choice-1"], ["readComprehension", "choice-1"], ["dialogue", "choice-1"]]) {
    test(`${type}: clicks the correct option`, async (t) => {
        const page = loadPage(LESSON_SCRIPTS, { html: `
            <button id="judge-0" data-test="challenge-judge-text"></button><button id="judge-1" data-test="challenge-judge-text"></button>
            <button id="choice-0" data-test="challenge-choice"></button><button id="choice-1" data-test="challenge-choice"></button>` });
        t.after(page.close);
        page.run(`window.sleep = () => Promise.resolve()`);
        const clicked = [];
        page.document.addEventListener("click", (e) => clicked.push(e.target.id));
        await challenge(page, { type, correctIndex: 1 }).get_async_solver()();
        assert.deepEqual(clicked, [expected]);
    });
}

const PARTIAL = { type: "partialReverseTranslate", displayTokens: [{ text: "Io " }, { text: "ho ", isBlank: true }, { text: "fame", isBlank: true }] };

function solvePartial(t, html) {
    const page = loadPage(LESSON_SCRIPTS, { html });
    t.after(page.close);
    const input = page.document.querySelector("[contenteditable]");
    const events = [];
    input.addEventListener("input", (e) => events.push(e.bubbles));
    challenge(page, PARTIAL).get_async_solver()();
    return { text: input.textContent, events };
}

test("partialReverseTranslate: types the answer shown in the page", (t) => {
    const r = solvePartial(t, `<span class="Id-Wa">ho fame</span>
        <div data-test="challenge challenge-partialReverseTranslate"><span class="tapBI" contenteditable="true"></span></div>`);
    assert.deepEqual(r, { text: "ho fame", events: [true] });
});

test("partialReverseTranslate: falls back to challenge data when hashed classes change", (t) => {
    const r = solvePartial(t, `<div data-test="challenge challenge-partialReverseTranslate"><span contenteditable="true"></span></div>`);
    assert.deepEqual(r, { text: "ho fame", events: [true] });
});

test("listenIsolation: clicks the correct option", async (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<button id="o0" class="ufykF"></button><button id="o1" class="ufykF"></button>` });
    t.after(page.close);
    page.run(`window.sleep = () => Promise.resolve()`);
    const clicked = [];
    page.document.addEventListener("click", (e) => clicked.push(e.target.id));
    await challenge(page, { type: "listenIsolation", correctIndex: 1 }).get_async_solver()();
    assert.deepEqual(clicked, ["o1"]);
});

// Live markup (Oct 2026): every match tile is a <button>, matched tiles get aria-disabled="true".
test("match: clicks each pair, skipping tiles already matched", async (t) => {
    const tile = (text) => `<button aria-disabled="false" class="_3fmUm" data-test="${text}-challenge-tap-token"><span data-test="challenge-tap-token-text">${text}</span></button>`;
    const page = loadPage(LESSON_SCRIPTS, { html: `<div data-test="challenge challenge-match"><div><div>
        <div>${["help", "soda", "帮", "汽水"].map(tile).join("")}</div></div></div></div>` });
    t.after(page.close);
    page.run(`window.sleep = () => Promise.resolve()`);
    const clicked = [];
    page.document.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        clicked.push(b.textContent);
        b.setAttribute("aria-disabled", "true");
    });
    await challenge(page, { type: "match", pairs: [{ fromToken: "soda", learningToken: "汽水" }, { fromToken: "help", learningToken: "帮" }] }).get_async_solver()();
    assert.deepEqual(clicked, ["soda", "汽水", "help", "帮"]);
});

// Live word-bank markup (Oct 2026): pressed tiles get aria-disabled="true" and another class.
function wordBankPage(t, tiles) {
    const tile = ([text, pressed]) => `<button aria-disabled="${pressed}" class="${pressed ? "_2wryV" : "_3fmUm"}" data-test="${text}-challenge-tap-token"><span data-test="challenge-tap-token-text">${text}</span></button>`;
    const page = loadPage(LESSON_SCRIPTS, { html: `<div data-test="word-bank">${tiles.map(tile).join("")}</div>` });
    t.after(page.close);
    page.run(`window.sleep = () => Promise.resolve()`);
    const clicked = [];
    page.document.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        clicked.push(b.textContent);
        b.setAttribute("aria-disabled", "true");
        b.className = "_2wryV";
    });
    return { page, clicked };
}

test("tap: picks unpressed tiles even when the first tile is already pressed", async (t) => {
    const { page, clicked } = wordBankPage(t, [["spicy", true], ["No", false], ["problem", false]]);
    await challenge(page, { type: "translate", challengeGeneratorIdentifier: { specificType: "tap" }, correctTokens: ["No", "problem"] }).solveByTapping();
    assert.deepEqual(clicked, ["No", "problem"]);
});

test("tap: repeated words use two different tiles", async (t) => {
    const { page, clicked } = wordBankPage(t, [["you", false], ["thank", false], ["you", false]]);
    await challenge(page, { type: "translate", challengeGeneratorIdentifier: { specificType: "tap" }, correctTokens: ["thank", "you", "you"] }).solveByTapping();
    assert.deepEqual(clicked, ["thank", "you", "you"]);
});
