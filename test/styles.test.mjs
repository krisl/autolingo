import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { read } from "./helpers.mjs";

test("every autolingo-* class in lesson.css is used by a script", () => {
    const css = read("styles/lesson.css");
    const scripts = readdirSync(new URL("../scripts/", import.meta.url)).map((f) => read(`scripts/${f}`)).join("\n");
    const classes = new Set(css.match(/\.autolingo-[\w-]+/g).map((c) => c.slice(1)));
    for (const c of classes) assert.ok(scripts.includes(`"${c}"`) || scripts.includes(`.${c}`), `unused class ${c}`);
});
