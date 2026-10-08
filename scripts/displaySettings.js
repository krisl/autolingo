// Display-settings bridge: runs in the default ISOLATED world (unlike the
// MAIN-world solvers) so it can use chrome.storage. Applies popup slider
// values as CSS variables consumed by styles/lesson.css, and the audio trim
// as <html data-al-audio-trim-ms> for the MAIN-world tap solver (it cannot
// read chrome.storage). Updates live.
function applyDisplaySettings(settings) {
    const root = document.documentElement;
    if (settings.alHanziScale != null) root.style.setProperty("--al-hanzi", settings.alHanziScale);
    if (settings.alPinyinScale != null) root.style.setProperty("--al-pinyin", settings.alPinyinScale);
    if (settings.alAudioTrimMs != null) root.dataset.alAudioTrimMs = String(settings.alAudioTrimMs);
}

chrome.storage.local.get(DISPLAY_DEFAULTS).then(applyDisplaySettings);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = {};
    if (changes.alHanziScale) next.alHanziScale = changes.alHanziScale.newValue;
    if (changes.alPinyinScale) next.alPinyinScale = changes.alPinyinScale.newValue;
    if (changes.alAudioTrimMs) next.alAudioTrimMs = changes.alAudioTrimMs.newValue;
    applyDisplaySettings(next);
});
