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
