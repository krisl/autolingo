// Central DOM selectors + null-safe lookup helpers.
// Loaded right after scripts/utils.js. When Duolingo renames a hashed class,
// add the new name here (primary first, known-good fallbacks after) instead
// of hunting call sites. data-test attributes are preferred: semantic, stable.
const SELECTORS = {
    // React lesson root (hashed class; read via getPageData() below).
    lessonRoot: ["._3yE3H"],
    // Footer player controls (stable data-test names).
    playerNext: ['[data-test="player-next"]'],
    playerSkip: ['[data-test="player-skip"]'],
    footer: ["#session\\/PlayerFooter"],
    buttonSection: ["div._3h0lA"],
    // Hanzi trace pad candidates, searched only inside challengeRoot:
    // page-wide, the largest svg can be a mascot or icon.
    tracePad: ["canvas", "svg"],
    traceSvg: [
        "[data-test='challenge challenge-characterWrite'] ._2GkiA svg",
        "[data-test='challenge challenge-characterTrace'] ._2GkiA svg",
    ],
    // Challenge roots for write/trace quizzes (scope for guide lookups).
    challengeRoot: [
        "[data-test='challenge challenge-characterWrite']",
        "[data-test='challenge challenge-characterTrace']",
        "[data-test*='characterWrite']",
        "[data-test*='characterTrace']",
    ],
    // Pair-match options container.
    matchContainer: ["div[data-test*='challenge'] > div > div > div"],
    // partialReverseTranslate answer + input (hashed classes first).
    partialAnswer: [".Id-Wa"],
    partialInput: [".tapBI", "[data-test='challenge challenge-partialReverseTranslate'] [contenteditable=true]"],
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

// Duolingo's lesson state (player.status, currentChallenge, course, ...),
// read from React props. The known path is tried first; if Duolingo moves
// things, walk up the fiber tree from stable elements until it shows up.
function getPageData() {
    const root = queryFirst(SELECTORS.lessonRoot, window.document, true);
    const known = window.getReactElement(root)?.return?.return?.memoizedProps;
    if (known?.player) return known;

    for (const start of [SELECTORS.lessonRoot, SELECTORS.playerNext]) {
        const el = queryFirst(start, window.document, true);
        for (let fiber = window.getReactElement(el); fiber; fiber = fiber.return) {
            const props = fiber.memoizedProps;
            if (props?.player?.status && "currentChallenge" in props) return props;
        }
    }
    return undefined;
}
