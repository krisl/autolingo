// svgPuzzle / syllableTap solver: tap token pieces in correctIndices order.
// Loaded after scripts/solver.js; attaches to DuolingoChallenge.prototype.
Object.assign(DuolingoChallenge.prototype, {

    async solveTapTokensInOrder() {
        // svgPuzzle (e.g. Chinese 裙 = 衤 + ... radicals), syllableTap
        // (e.g. white = 白 + 色 syllables): tap pieces in correctIndices
        // order. Buttons carry data-test="{text}-challenge-tap-token".
        for (const idx of this.challengeInfo.correctIndices) {
            const text = this.challengeInfo.choices[idx]?.text;
            if (text == null) continue;
            let btn = queryFirst([`[data-test="${text}-challenge-tap-token"]`]);
            if (!btn) {
                // Fallback: match by visible text among tap-token buttons.
                const cands = Array.from(document.querySelectorAll('[data-test$="challenge-tap-token"]'));
                btn = cands.find((b) => (b.textContent ?? "").includes(text));
            }
            window.console.logger({ tapTokenTap: text, found: !!btn });
            btn?.click();
            // Let the syllable audio finish (e.g. 白 "bái") before the next
            // tap cuts it off. No audio playing (svgPuzzle radicals) = short wait.
            await sleep(200);
            let playing = null;
            try {
                playing = typeof Howler !== "undefined"
                    ? Howler._howls.find((o) => { try { return o.playing(); } catch (e) { return false; } })
                    : null;
            } catch (e) { playing = null; }
            if (playing) {
                const remaining = playing.duration() - playing.seek();
                await sleep(Math.max(200, remaining * 1000 - 900));
            } else {
                await sleep(150);
            }
        }
    },
});
