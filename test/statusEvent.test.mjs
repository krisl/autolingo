import { test } from "node:test";
import assert from "node:assert/strict";
import { LESSON_SCRIPTS, loadPage, setFiber } from "./helpers.mjs";

function pageWithLessonData(props) {
    const page = loadPage(LESSON_SCRIPTS, { html: `<div class="_3yE3H"></div>` });
    setFiber(page.document.querySelector("._3yE3H"), { return: { return: { memoizedProps: props } } });
    return page;
}

test("status watcher survives page data without a course", (t) => {
    const page = pageWithLessonData({ player: { status: "GUESSING" }, currentChallenge: { type: "select" } });
    t.after(page.close);
    const seen = [];
    page.window.addEventListener("LessonStatusChanged", (e) => seen.push(e.detail.player.status));
    page.run("pollLessonStatus()");
    assert.deepEqual(seen, ["GUESSING"]);
});
