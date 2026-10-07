// Popup sliders for display scaling. Writes straight to chrome.storage;
// scripts/displaySettings.js picks it up live on every Duolingo tab.
function bindSlider(sliderId, valueId, storageKey, fallback) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);

    const render = (factor) => {
        slider.value = Math.round(factor * 100);
        value.innerText = `${Math.round(factor * 100)}%`;
    };

    chrome.storage.local.get({ [storageKey]: fallback }).then((stored) => {
        render(stored[storageKey]);
    });

    slider.addEventListener("input", () => {
        const factor = slider.value / 100;
        render(factor);
        chrome.storage.local.set({ [storageKey]: factor });
    });
}

bindSlider("hanzi-slider", "hanzi-value", "alHanziScale", DISPLAY_DEFAULTS.alHanziScale);
bindSlider("pinyin-slider", "pinyin-value", "alPinyinScale", DISPLAY_DEFAULTS.alPinyinScale);

// Current build id (scripts/buildStamp.js). The Solve button shows the id
// its tab was loaded with; a different id there means: reload that tab.
chrome.storage.local.get("alBuild").then(({ alBuild }) => {
    document.getElementById("build-id").innerText = alBuild ?? "?";
});
