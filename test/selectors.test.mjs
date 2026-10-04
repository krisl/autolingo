import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, setFiber } from "./helpers.mjs";

const lessonProps = { player: { status: "GUESSING" }, currentChallenge: { type: "select" } };

test("getPageData: reads the known lesson root path", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div class="_3yE3H"></div>` });
    t.after(page.close);
    page.window.lessonProps = lessonProps;
    setFiber(page.document.querySelector("._3yE3H"), { return: { return: { memoizedProps: lessonProps } } });
    assert.equal(page.run("getPageData() === window.lessonProps"), true);
});

test("getPageData: walks up from player-next when the lesson root class changes", (t) => {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div class="_renamed"><button data-test="player-next"></button></div>` });
    t.after(page.close);
    page.window.lessonProps = lessonProps;
    setFiber(page.document.querySelector("button"), {
        memoizedProps: { children: [] },
        return: { memoizedProps: { player: "not an object with status" },
            return: { memoizedProps: lessonProps } },
    });
    assert.equal(page.run("getPageData() === window.lessonProps"), true);
});

test("getPageData: undefined outside a lesson", (t) => {
    const page = loadPage(LESSON_SCRIPTS);
    t.after(page.close);
    assert.equal(page.run("getPageData()"), undefined);
});
