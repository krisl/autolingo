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
