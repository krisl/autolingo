import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { manifest, read, loadPage, tick } from "./helpers.mjs";

// Run the service worker with a fake chrome API whose files are `files`.
async function stamp(files) {
    const stored = {};
    const listeners = [];
    const chrome = {
        runtime: {
            getManifest: () => manifest,
            getURL: (f) => f,
            onInstalled: { addListener: (fn) => listeners.push(fn) },
            onStartup: { addListener: (fn) => listeners.push(fn) },
        },
        storage: { local: { set: async (o) => Object.assign(stored, o) } },
    };
    const fetch = async (f) => ({ text: async () => files[f] ?? read(f) });
    vm.runInNewContext(read(manifest.background.service_worker), { chrome, fetch, crypto, TextEncoder });
    assert.equal(listeners.length, 2, "hashes on install/reload and on browser start only");
    await listeners[0]();
    return stored.alBuild;
}

test("build id: short hex, stable, changes when any injected file changes", async () => {
    const a = await stamp({});
    assert.match(a, /^[0-9a-f]{6}$/);
    assert.equal(await stamp({}), a);
    assert.notEqual(await stamp({ "scripts/traceSolver.js": read("scripts/traceSolver.js") + "\n// edit" }), a);
    assert.notEqual(await stamp({ "styles/lesson.css": read("styles/lesson.css") + " " }), a);
});

test("build badge: page gets the id it was loaded with as a CSS string", async (t) => {
    const page = loadPage([], {
        setup: (w) => { w.chrome = { storage: { local: { get: async () => ({ alBuild: "abc123" }) } } }; },
    });
    t.after(page.close);
    page.run(read("scripts/buildBadge.js"));
    await tick();
    assert.equal(page.document.documentElement.style.getPropertyValue("--al-build"), '"abc123"');
});
