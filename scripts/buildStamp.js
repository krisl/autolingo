// Background service worker: when the extension (re)loads, hash the files
// the manifest injects and store a short build id ("alBuild"). Each page
// shows the id it was loaded with on the Solve button (buildBadge.js); the
// popup shows the current one. A tab whose id differs still runs code from
// before the last reload. Only hashed on install/reload/browser start:
// those are the moments Chrome reads the files, so the id matches the code.
async function stampBuild() {
    const files = [...new Set(chrome.runtime.getManifest().content_scripts.flatMap((c) => [...(c.js ?? []), ...(c.css ?? [])]))];
    const texts = await Promise.all(files.map((f) => fetch(chrome.runtime.getURL(f)).then((r) => r.text())));
    const bytes = new TextEncoder().encode(files.map((f, i) => `${f}\n${texts[i]}`).join("\n"));
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const alBuild = [...digest.slice(0, 3)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await chrome.storage.local.set({ alBuild });
}

chrome.runtime.onInstalled.addListener(stampBuild);
chrome.runtime.onStartup.addListener(stampBuild);
