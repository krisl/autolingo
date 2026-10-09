// Test helpers: load the extension's classic scripts into a jsdom page,
// sharing one global scope the way Chrome does for content scripts.
import vm from "node:vm";
import { beforeEach } from "node:test";
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

// Fake clock in every test: setTimeout, setInterval (and so jsdom's
// requestAnimationFrame) and Date only move when a test moves them, so no
// test depends on real time or on how busy the machine is. Each page's
// 500 ms status poll stays still too, unless a test advances the clock.
// Limits below are in fake ms. t.mock restores real timers after each test.
const FAKE_START = Date.parse("2026-01-01T00:00:00Z");
beforeEach((t) => t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: FAKE_START }));

// Let every queued promise callback (and MutationObserver) run, with no
// time passing. setImmediate is not faked, and runs after all of them.
export const flush = () => new Promise((r) => setImmediate(r));

// Move the fake clock forward by ms, 1 ms at a time, so code that awaits
// between timers sets its next timer before that timer is due.
export async function advance(t, ms) {
    for (let i = 0; i < ms; i++) {
        await flush();
        t.mock.timers.tick(1);
    }
    await flush();
}

// Move the fake clock until cond() holds.
export async function until(t, cond, what = "condition", maxMs = 5000) {
    for (let ms = 0; ms <= maxMs; ms++) {
        await flush();
        if (cond()) return;
        t.mock.timers.tick(1);
    }
    throw new Error(`${what}: still false after ${maxMs} fake ms`);
}

// Move the fake clock until promise settles; its value (or throw).
export async function settle(t, promise, maxMs = 5000) {
    let done = false;
    const watched = promise.finally(() => { done = true; });
    await until(t, () => done, "promise settled", maxMs);
    return watched;
}
