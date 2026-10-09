import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, until } from "./helpers.mjs";

const FOOTER = `<div id="session/PlayerFooter"><div><button data-test="player-next"><span>Check</span></button></div></div>`;
const AUTOSOLVE_URL = "https://www.duolingo.com/lesson?autosolve=true";

// Lesson page whose solver is a stub that counts its runs and only ends
// when the test calls finishSolve(): no test depends on how long a solve takes.
function lessonWithStubSolver(t, url) {
    const page = loadPage(LESSON_SCRIPTS, { html: FOOTER, url });
    t.after(page.close);
    page.window.solverRuns = 0;
    page.run(`window.pendingSolves = [];
    DuolingoChallenge.prototype.get_async_solver = function () {
        return () => { window.solverRuns++; return new Promise((r) => window.pendingSolves.push(r)); };
    };`);
    const guessing = (type = "select") => page.window.dispatchEvent(new page.window.CustomEvent("LessonStatusChanged", {
        detail: { player: { status: "GUESSING" }, currentChallenge: { type } },
    }));
    const finishSolve = () => page.window.pendingSolves.splice(0).forEach((r) => r());
    // lessonPage.js clears its guard a few steps after the solver ends.
    const guardReleased = () => until(t, () => !page.run("autolingoSolving"), "solve guard released");
    return { ...page, guessing, finishSolve, guardReleased, solveButton: () => page.document.querySelector("button.autolingo-solve") };
}

test("solve button ignores clicks while a solve is running", async (t) => {
    const page = lessonWithStubSolver(t);
    page.guessing();
    page.solveButton().click();
    page.solveButton().click();
    assert.equal(page.window.solverRuns, 1);

    page.finishSolve();
    await page.guardReleased();
    assert.equal(page.window.solverRuns, 1, "the ignored click is not replayed later");

    page.solveButton().click();
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

// "Does not happen" checks: the page without ?autosolve gets the event
// first, so by the time its twin with ?autosolve has reacted, it would
// have reacted too. The fake clock fires timers in the order they were set.
test("autosolve: solves on GUESSING only with ?autosolve", async (t) => {
    const off = lessonWithStubSolver(t);
    const on = lessonWithStubSolver(t, AUTOSOLVE_URL);
    off.guessing();
    on.guessing();
    await until(t, () => on.window.solverRuns === 1, "autosolve ran");
    assert.equal(off.window.solverRuns, 0);
});

test("autosolve: a manual click during autosolve does not solve twice", async (t) => {
    const page = lessonWithStubSolver(t, AUTOSOLVE_URL);
    page.guessing();
    await until(t, () => page.window.solverRuns === 1, "autosolve ran");
    page.solveButton().click();
    page.finishSolve();
    await page.guardReleased();
    assert.equal(page.window.solverRuns, 1);
});

test("autosolve: clicks continue on BLAMING only with ?autosolve", async (t) => {
    const blaming = (url) => {
        const page = lessonWithStubSolver(t, url);
        const next = { clicks: 0 };
        page.document.querySelector("[data-test=player-next]").addEventListener("click", () => next.clicks++);
        page.window.dispatchEvent(new page.window.CustomEvent("LessonStatusChanged", { detail: { player: { status: "BLAMING" } } }));
        return next;
    };
    const off = blaming("https://www.duolingo.com/lesson");
    const on = blaming(AUTOSOLVE_URL);
    await until(t, () => on.clicks === 1, "autosolve clicked continue");
    assert.equal(off.clicks, 0);
});
