import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ROOT, manifest, LESSON_SCRIPTS, loadPage } from "./helpers.mjs";

test("every file the manifest references exists", () => {
    const files = [
        manifest.background?.service_worker,
        manifest.action.default_popup,
        ...Object.values(manifest.icons),
        ...manifest.content_scripts.flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]),
    ].filter(Boolean);
    for (const f of files) assert.ok(existsSync(new URL(f, ROOT)), `missing ${f}`);
});

test("lesson scripts load together without errors", (t) => {
    const page = loadPage(LESSON_SCRIPTS);
    t.after(page.close);
    assert.deepEqual(page.errors, []);
    assert.equal(typeof page.run("DuolingoChallenge"), "function");
});
