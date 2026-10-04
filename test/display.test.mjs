import { test } from "node:test";
import assert from "node:assert/strict";
import { manifest, read, loadPage, tick } from "./helpers.mjs";

// chrome.storage.local stub with nothing stored yet.
const emptyStorage = (window) => {
    window.chrome = { storage: {
        local: { get: async (defaults) => ({ ...defaults }), set: async () => {} },
        onChanged: { addListener() {} },
    } };
};

test("popup and lesson page start from the same default sizes", async (t) => {
    const popupHtml = read("popup/popup.html");
    const popupScripts = [...popupHtml.matchAll(/<script src="([^"]+)"/g)].map((m) => new URL(m[1], "file:///popup/").pathname.slice(1));
    const popup = loadPage(popupScripts, { html: popupHtml.match(/<body>([\s\S]*)<\/body>/)[1], setup: emptyStorage });
    t.after(popup.close);

    const isolated = manifest.content_scripts.find((c) => c.js.includes("scripts/displaySettings.js")).js;
    const lesson = loadPage(isolated, { setup: emptyStorage });
    t.after(lesson.close);
    await tick();

    // jsdom has no real innerText: reading it back returns what popup.js set.
    const style = lesson.document.documentElement.style;
    assert.equal(popup.document.getElementById("hanzi-value").innerText, `${Math.round(style.getPropertyValue("--al-hanzi") * 100)}%`);
    assert.equal(popup.document.getElementById("pinyin-value").innerText, `${Math.round(style.getPropertyValue("--al-pinyin") * 100)}%`);
    assert.equal(style.getPropertyValue("--al-hanzi"), "1.35");
});
