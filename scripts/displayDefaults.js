// Default popup settings, shared by popup/popup.js and scripts/displaySettings.js.
// styles/lesson.css repeats the scales as var() fallbacks.
const DISPLAY_DEFAULTS = {
    alHanziScale: 1.35,
    alPinyinScale: 1,
    // Tap the next tile when this much of a tile's audio is left (its
    // trailing silence). 0 = let every clip play to the end.
    alAudioTrimMs: 0,
};
