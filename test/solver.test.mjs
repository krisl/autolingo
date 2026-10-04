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
    }).solveFromNearbyElements();
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
    assert.doesNotThrow(() => c.solveWriteTextInSomeTextFieldTypeProblems());
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
    }).solveTapTextTypeProblems();
    assert.equal(clicks, 1);
});
