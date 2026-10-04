import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, tick } from "./helpers.mjs";

const FOOTER = `<div id="session/PlayerFooter"><div><button data-test="player-next"><span>Check</span></button></div></div>`;

// Lesson page whose solver is a slow stub that counts its runs.
function lessonWithStubSolver(t, url) {
    const page = loadPage(LESSON_SCRIPTS, { html: FOOTER, url });
    t.after(page.close);
    page.window.solverRuns = 0;
    page.run(`DuolingoChallenge.prototype.get_async_solver = function () {
        return async () => { window.solverRuns++; await sleep(30); };
    };`);
    const guessing = (type = "select") => page.window.dispatchEvent(new page.window.CustomEvent("LessonStatusChanged", {
        detail: { player: { status: "GUESSING" }, currentChallenge: { type } },
    }));
    return { ...page, guessing, solveButton: () => page.document.querySelector("button.autolingo-solve") };
}

test("solve button ignores clicks while a solve is running", async (t) => {
    const page = lessonWithStubSolver(t);
    page.guessing();
    page.solveButton().click();
    page.solveButton().click();
    await tick(60);
    assert.equal(page.window.solverRuns, 1);

    page.solveButton().click();
    await tick(60);
    assert.equal(page.window.solverRuns, 2, "guard is released after the solve ends");
});
