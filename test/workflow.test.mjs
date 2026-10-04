import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read } from "./helpers.mjs";

test("release workflow stamps the date into manifest version", () => {
    const workflow = read(".github/workflows/main.yml");
    const step = workflow.match(/Replace version name in manifest\.json\s*\n\s*run: (.+)/);
    assert.ok(step, "version step not found");
    const cmd = step[1].replace(/\$\{\{ steps\.actual-date\.outputs\.DATE \}\}/g, "2026.10.04");

    const dir = mkdtempSync(join(tmpdir(), "autolingo-"));
    writeFileSync(join(dir, "manifest.json"), read("manifest.json"));
    execSync(cmd, { cwd: dir });
    assert.equal(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")).version, "2026.10.04");
});
