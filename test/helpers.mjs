// Test helpers: load the extension's classic scripts into a jsdom page,
// sharing one global scope the way Chrome does for content scripts.
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";

export const ROOT = new URL("../", import.meta.url);
export const read = (file) => readFileSync(new URL(file, ROOT), "utf8");
export const manifest = JSON.parse(read("manifest.json"));

// Scripts of the MAIN-world content script, in manifest order.
export const LESSON_SCRIPTS = manifest.content_scripts.find((c) => c.world === "MAIN").js;

export function loadPage(scripts, { html = "", url = "https://www.duolingo.com/lesson", setup } = {}) {
    const logs = [];
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("log", (...args) => logs.push(args));
    virtualConsole.on("error", (...args) => errors.push(args));
    virtualConsole.on("jsdomError", (e) => errors.push([e]));
    const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
        url,
        runScripts: "outside-only",
        pretendToBeVisual: true,
        virtualConsole,
    });
    const ctx = dom.getInternalVMContext();
    const run = (src, filename = "inline.js") => new vm.Script(src, { filename }).runInContext(ctx);
    setup?.(dom.window);
    for (const file of scripts) run(read(file), file);
    return { window: dom.window, document: dom.window.document, run, logs, errors, close: () => dom.window.close() };
}

// Give a DOM node a fake React fiber, like React's "__reactFiber$<random>" key.
export function setFiber(el, fiber) {
    el["__reactFiber$test"] = fiber;
    return fiber;
}

// Fake layout box: jsdom has no layout, every rect is 0x0 otherwise.
export function setRect(el, { left = 0, top = 0, width, height }) {
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; } });
}

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
