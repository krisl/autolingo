// Autosolve: dormant, kept for later (e.g. skipping whole irrelevant lessons).
// Only active when the lesson URL has ?autosolve (or ?repeat=N). It presses
// the Solve button lessonPage.js inserts, so the same solve guard applies.
// To switch it off completely, remove this file from manifest.json.
//
// Known gap: nothing clicks Check after solving (see the commented
// clickButtonCheck in lessonPage.js), so a lesson may stall on GUESSING.

function handleAutosolveRequest() {
    confirm("Reload page to start autosolving?") ? location.assign(location.pathname + "?autosolve=true") : null;
}

window.addEventListener("LessonStatusChanged", async function ({ detail: pageData }) {
    const autosolve = document.location.search.includes("autosolve");
    switch (pageData.player?.status) {
        case "GUESSING":
            if (!autosolve) break;
            await sleep();
            if (!clickFirst(["button.autolingo-solve"])) {
                window.console.logger("autosolve: no Solve button (unsupported challenge?)");
            }
            break;

        case "BLAMING":
        case "COACH_DUO":
        case "HARD_MODE_DUO":
        case "LEGENDARY_DUO":
        case "PARTIAL_XP_DUO":
        case "CAPSTONE_REVIEW_SPLASH":
        case "COACH_DUO_SPLASH":
        case "VISIBLE_PERSONALIZATION_SPLASH":
        case "PLACEMENT_SPLASH":
        case "UNIT_TEST_SPLASH":
            if (autosolve) { await sleep(); DuolingoChallenge.clickButtonContinue() };
            break;

        case "END_CAROUSEL":
            const urlObject = new URL(document.location);
            if (urlObject.search.includes("repeat")) {
                const value = urlObject.searchParams.get("repeat");
                if (!value || isNaN(Number(value))) { await sleep(); location.reload() };
                if (Number(value) > 0) { await sleep(); location.assign(location.pathname + "?autosolve&repeat=" + (Number(value) - 1)) };
            };
            break;
    }
});
