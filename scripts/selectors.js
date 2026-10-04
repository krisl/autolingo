// Central DOM selectors + null-safe lookup helpers.
// Loaded right after scripts/utils.js. When Duolingo renames a hashed class,
// add the new name here (primary first, known-good fallbacks after) instead
// of hunting call sites. data-test attributes are preferred: semantic, stable.
const SELECTORS = {
    // React lesson root (hashed class; see also duolingoStatusEvent.js).
    lessonRoot: ["._3yE3H"],
    // Footer player controls (stable data-test names).
    playerNext: ['[data-test="player-next"]'],
    playerSkip: ['[data-test="player-skip"]'],
    footer: ["#session\\/PlayerFooter"],
    buttonSection: ["div._3h0lA"],
    // Hanzi trace pad candidates, most specific first.
    tracePad: [
        "[data-test='challenge challenge-characterWrite'] canvas",
        "[data-test='challenge challenge-characterWrite'] svg",
        "[data-test='challenge challenge-characterTrace'] canvas",
        "[data-test='challenge challenge-characterTrace'] svg",
        "[data-test*='characterWrite']",
        "[data-test*='characterTrace']",
        "[data-test*='trace']",
        "[data-test*='write']",
        "canvas",
        "svg",
    ],
    traceSvg: [
        "[data-test='challenge challenge-characterWrite'] ._2GkiA svg",
        "[data-test='challenge challenge-characterTrace'] ._2GkiA svg",
    ],
    // Challenge roots for write/trace quizzes (scope for guide lookups).
    challengeRoot: [
        "[data-test='challenge challenge-characterWrite']",
        "[data-test='challenge challenge-characterTrace']",
    ],
    // Pair-match options container.
    matchContainer: ["div[data-test*='challenge'] > div > div > div"],
    // Fill-in / cloze answer nodes (hashed classes, fragile by nature).
    partialAnswer: [".Id-Wa"],
    partialInput: [".tapBI"],
    clozeAnswer: [".caPDQ"],
    clozeInput: [".Y5JxA._17nEt"],
    listenButtons: [".ufykF"],
};

// First element matching any selector, or null (with a loud log on total miss,
// unless quiet — use quiet for hot polling paths like the status watcher).
function queryFirst(selectors, root = window.document, quiet = false) {
    for (const sel of selectors) {
        let el = null;
        try {
            el = root.querySelector(sel);
        } catch (e) {
            window.console.logger("invalid selector, skipping:", sel);
            continue;
        }
        if (el) return el;
    }
    if (!quiet) window.console.logger("selector missed:", selectors[0]);
    return null;
}

// Click first match; false (not throw) when nothing matches.
function clickFirst(selectors, root = window.document) {
    const el = queryFirst(selectors, root);
    if (!el) return false;
    el.click();
    return true;
}
