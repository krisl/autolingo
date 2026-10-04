// Popup sliders for display scaling. Writes straight to chrome.storage;
// scripts/displaySettings.js picks it up live on every Duolingo tab.
const HANZI_DEFAULT = 1.35;
const PINYIN_DEFAULT = 1;

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

bindSlider("hanzi-slider", "hanzi-value", "alHanziScale", HANZI_DEFAULT);
bindSlider("pinyin-slider", "pinyin-value", "alPinyinScale", PINYIN_DEFAULT);
