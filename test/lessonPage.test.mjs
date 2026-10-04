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

test("solve button goes into Duolingo's button section when there is one", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div id="session/PlayerFooter"><div>
        <div class="_3h0lA"><button data-test="player-next"><span>Check</span></button></div></div></div>` });
    t.after(page.close);
    page.window.dispatchEvent(new page.window.CustomEvent("LessonStatusChanged", {
        detail: { player: { status: "GUESSING" }, currentChallenge: { type: "select" } } }));
    assert.equal(page.document.querySelector("button.autolingo-solve").parentElement.className, "_3h0lA");
});

test("solve button gets its own section when Duolingo has none", (t) => {
    const page = lessonWithStubSolver(t);
    page.guessing();
    assert.equal(page.solveButton().parentElement.className, "autolingo-buttonsection");
});

test("autosolve: solves on GUESSING only with ?autosolve", async (t) => {
    const off = lessonWithStubSolver(t);
    off.guessing();
    await tick(60);
    assert.equal(off.window.solverRuns, 0);

    const on = lessonWithStubSolver(t, "https://www.duolingo.com/lesson?autosolve=true");
    on.guessing();
    await tick(60);
    assert.equal(on.window.solverRuns, 1);
});

test("autosolve: a manual click during autosolve does not solve twice", async (t) => {
    const page = lessonWithStubSolver(t, "https://www.duolingo.com/lesson?autosolve=true");
    page.guessing();
    await tick(5);
    page.solveButton().click();
    await tick(60);
    assert.equal(page.window.solverRuns, 1);
});

test("autosolve: clicks continue on BLAMING only with ?autosolve", async (t) => {
    for (const [url, expected] of [["https://www.duolingo.com/lesson", 0], ["https://www.duolingo.com/lesson?autosolve=true", 1]]) {
        const page = lessonWithStubSolver(t, url);
        let clicks = 0;
        page.document.querySelector("[data-test=player-next]").addEventListener("click", () => clicks++);
        page.window.dispatchEvent(new page.window.CustomEvent("LessonStatusChanged", { detail: { player: { status: "BLAMING" } } }));
        await tick(10);
        assert.equal(clicks, expected, url);
    }
});
