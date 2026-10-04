// svgPuzzle solver (e.g. Chinese hanzi assembled from radical pieces).
// Loaded after scripts/solver.js; attaches to DuolingoChallenge.prototype.
Object.assign(DuolingoChallenge.prototype, {

    async solveSvgPuzzle() {
        // Tap radical pieces in correctIndices order.
        // Buttons carry data-test="{text}-challenge-tap-token".
        for (const idx of this.challengeInfo.correctIndices) {
            const text = this.challengeInfo.choices[idx]?.text;
            if (text == null) continue;
            let btn = document.querySelector(`[data-test="${text}-challenge-tap-token"]`);
            if (!btn) {
                // Fallback: match by visible text among tap-token buttons.
                const cands = Array.from(document.querySelectorAll('[data-test$="challenge-tap-token"]'));
                btn = cands.find((b) => (b.textContent ?? "").includes(text));
            }
            window.console.logger({ svgPuzzleTap: text, found: !!btn });
            btn?.click();
            await sleep(300);
        }
    },
});
