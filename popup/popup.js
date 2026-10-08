// Popup sliders for display scaling. Writes straight to chrome.storage;
// scripts/displaySettings.js picks it up live on every Duolingo tab.
// Stored value = slider value / scale, shown with unit.
function bindSlider(sliderId, valueId, storageKey, fallback, { scale = 100, unit = "%" } = {}) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);

    const render = (stored) => {
        slider.value = Math.round(stored * scale);
        value.innerText = `${Math.round(stored * scale)}${unit}`;
    };

    chrome.storage.local.get({ [storageKey]: fallback }).then((stored) => {
        render(stored[storageKey]);
    });

    slider.addEventListener("input", () => {
        const stored = slider.value / scale;
        render(stored);
        chrome.storage.local.set({ [storageKey]: stored });
    });
}

bindSlider("hanzi-slider", "hanzi-value", "alHanziScale", DISPLAY_DEFAULTS.alHanziScale);
bindSlider("pinyin-slider", "pinyin-value", "alPinyinScale", DISPLAY_DEFAULTS.alPinyinScale);
bindSlider("trim-slider", "trim-value", "alAudioTrimMs", DISPLAY_DEFAULTS.alAudioTrimMs, { scale: 1, unit: " ms" });

// Current build id (scripts/buildStamp.js). The Solve button shows the id
// its tab was loaded with; a different id there means: reload that tab.
chrome.storage.local.get("alBuild").then(({ alBuild }) => {
    document.getElementById("build-id").innerText = alBuild ?? "?";
});
