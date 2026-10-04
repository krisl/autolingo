// Display-settings bridge: runs in the default ISOLATED world (unlike the
// MAIN-world solvers) so it can use chrome.storage. Applies popup slider
// values as CSS variables consumed by styles/lesson.css. Updates live.
const DISPLAY_DEFAULTS = {
    alHanziScale: 1.35,
    alPinyinScale: 1,
};

function applyDisplaySettings(settings) {
    const root = document.documentElement;
    if (settings.alHanziScale != null) root.style.setProperty("--al-hanzi", settings.alHanziScale);
    if (settings.alPinyinScale != null) root.style.setProperty("--al-pinyin", settings.alPinyinScale);
}

chrome.storage.local.get(DISPLAY_DEFAULTS).then(applyDisplaySettings);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = {};
    if (changes.alHanziScale) next.alHanziScale = changes.alHanziScale.newValue;
    if (changes.alPinyinScale) next.alPinyinScale = changes.alPinyinScale.newValue;
    applyDisplaySettings(next);
});
