class DuolingoChallenge {
    constructor(pageData) {
        this.challengeInfo = pageData.currentChallenge;
    }

    get isKeyboardEnabled() {
        const pageData = getPageData();
        const result = !!pageData?.challengeToggleState?.isToggledToTyping;
        window.console.logger({isKeyboardEnabled: result})
        return result
    }

    static getElementsByDataTest(dataTest, parent = window.document) {
        return Array.from(parent.querySelectorAll(`[data-test="${dataTest}"]`));
    }

    printDebugInfo() {
        window.console.logger("challengeType: " + this.challengeInfo.type);
        window.console.logger(this.challengeInfo);
        const tts = this.challengeInfo.solutionTts
        if (tts) {
          window.console.logger('tts', tts);
        }
    }

    extractTextFromNodes(nodes) {
        // From an array with nodes, it tries to get extract the user displayed in screen text.
        // Then, it returns an object with the text as the key and the node as the value.

        return Object.fromEntries(nodes.map((node) => {
            let rubyNode = node.querySelector("ruby");
            let nodeText = "";

            if (rubyNode) {
                nodeText = Array.from(rubyNode.querySelectorAll("span")).map((e) => e.textContent).join("");
            } else {
                let textOptionOne = this.constructor.getElementsByDataTest("challenge-tap-token-text", node)[0]?.textContent;
                let textOptionTwo = node.querySelector("[lang]")?.textContent;
                nodeText = textOptionOne ?? textOptionTwo;
            }

            return [nodeText, node];
        }));
    }

    // Methods for simulating user interaction (false, not throw, when absent).
    static clickButtonCheck() {
        return clickFirst(SELECTORS.playerNext);
    }

    static clickButtonContinue() {
        return clickFirst(SELECTORS.playerNext);
    }

    static clickButtonSkip() {
        return clickFirst(SELECTORS.playerSkip);
    }

    static insertText(textFieldDataTest, value) {
        let fieldText = this.getElementsByDataTest(textFieldDataTest)[0];
        if (!fieldText) {
            window.console.logger("insertText: missing field", textFieldDataTest);
            return false;
        }
        window.getReactElement(fieldText)?.pendingProps?.onChange({ target: { value } });
        return true;
    }

    // Methods for solving the problems.
    get_async_solver() {
        switch (this.challengeInfo.type) {
            case "dialogue":
            case "readComprehension":
            case "characterIntro":
            case "characterSelect":
            case "selectPronunciation":
            case "select":
            case "assist":
            case "gapFill":
            case "reverseAssist":
            case "transliterationAssist":
                return () => this.solveMultipleChoice();

            case "characterMatch":
            case "match":
                return () => this.solveCharacterMatch();
            
            case "translate":
            case "listenTap":
            case "name":
                return () => this.isKeyboardEnabled ? this.solveByTyping() : this.solveByTapping();

            case "transliterate":
                return () => this.solveByTyping();

            case "tapComplete":
                return () => this.solveByTapping();

            case "svgPuzzle":
                return () => this.solveSvgPuzzle();

            case "characterTrace":
            case "characterWrite":
                return () => this.solveCharacterWrite();

            case "listenComprehension":
            case "listenIsolation":
                return () => this.solveListenIsolation();

            case "listen":
                return () => this.solveListen();

            case "listenComplete":
                return () => this.solveFillBlank();
            case "completeReverseTranslation":
                return () => this.isKeyboardEnabled ? this.solveByTyping() : this.solveFillBlank();
            case "partialReverseTranslate":
                return () => this.solvePartialReverseTranslate();
        }
    }
    solvePartialReverseTranslate() {
        // Prefer the answer shown in the page; the challenge data is the
        // fallback when Duolingo renames the hashed class.
        const correctAnswer = queryFirst(SELECTORS.partialAnswer)?.textContent
            ?? this.challengeInfo.displayTokens.filter(dt => dt.isBlank).map(dt => dt.text).join('');
        let inputElement = queryFirst(SELECTORS.partialInput);
        if (!inputElement) return;

        inputElement.textContent = correctAnswer;
    
        // Create a new 'input' event
        let event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
    
        // Dispatch the event
        inputElement.dispatchEvent(event);
    }

    solveFillBlank() {
        const correctAnswer = this.challengeInfo.displayTokens.find(dt => dt.isBlank).text

        let textField = this.constructor.getElementsByDataTest("challenge-text-input")[0];
        if (!textField) {
            window.console.logger("nearbyElements: missing text field");
            return;
        }
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: correctAnswer } });
        console.logger({textField})
        window.setTimeout(() => {
            const parent = textField.parentNode.parentNode.parentNode
            const solutionBox = document.createElement("textarea");
            solutionBox.className = "_2OQj6 _3zGeZ _394fY RpiVp";
            solutionBox.disabled = true;
            solutionBox.textContent = this.challengeInfo.challengeResponseTrackingProperties.best_solution;
            parent.replaceChildren(solutionBox);
        }, 1);
    }

    async solveListenIsolation() {
        const buttons = document.querySelectorAll(SELECTORS.listenButtons[0]);
        if (!buttons[this.challengeInfo.correctIndex]) {
            window.console.logger("listenIsolation: missing button", this.challengeInfo.correctIndex);
            return;
        }
        buttons[this.challengeInfo.correctIndex].click();
        await sleep();
    }

    solveListen() {
        let bestSolution = this.challengeInfo.challengeResponseTrackingProperties.best_solution;
        let textField = this.constructor.getElementsByDataTest("challenge-translate-input")[0];
        if (!textField) {
            window.console.logger("solveListen: missing text field");
            return;
        }
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: bestSolution } });
    }

    async solveMultipleChoice() {
        // This method clicks the correct button from an array of possible buttons.
        // It uses the "data-test" attribute to identify possible buttons.
        let correctIndex = this.challengeInfo.correctIndex;
        let dataTest = this.challengeInfo.type === "characterIntro" ? "challenge-judge-text" : "challenge-choice";
        let buttons = this.constructor.getElementsByDataTest(dataTest);
        if (!buttons[correctIndex]) {
            window.console.logger("select: missing button", { type: this.challengeInfo.type, correctIndex });
            return;
        }
        buttons[correctIndex].click();
        await sleep();
    }
    
    solveByTyping() {
        // This method inserts a text inside some valid text field.
        // It uses "data-test" attribute to identify the text field.

        let specificTypeProblem = this.challengeInfo.challengeGeneratorIdentifier.specificType;
        let solution = (() => {
            switch (specificTypeProblem) {
                case "tap":
                case "listen_tap":
                    return this.challengeInfo.prompt;

                case "reverse_tap":
                case "reverse_translate":
                case "transliterate":
                case "translate":
                case "name":
                    return this.challengeInfo.correctSolutions[0];

                case "complete_reverse_translation":
                    return this.challengeInfo.challengeResponseTrackingProperties.best_solution;

                default:
                    alert("Unknown translate problem type: " + specificTypeProblem);
                    throw new Error(specificTypeProblem);
            }
        })();

        window.console.logger({solution, tts: this.challengeInfo.solutionTts});
        const dataTextByChallengeType = {
            "translate": "challenge-translate-input",
            "listenTap": "challenge-translate-input",
            "transliterate": "challenge-text-input",
            "name": "challenge-text-input",
            "completeReverseTranslation": "challenge-translate-input"
        }

        const dataTest = dataTextByChallengeType[this.challengeInfo.type];
  	if (!dataTest) {
            console.logger(`couldnt obtain data-test attribute for challenge info type '${this.challengeInfo.type}'`)
            return
        }
        this.constructor.insertText(dataTest, solution);
        const tts = this.challengeInfo.solutionTts
        // curl -v https://translate.googleapis.com/translate_tts\?client\=gtx\&ie-UTF-8\&tl\=it\&q\=ciao
        // Howl is Duolingo's audio library global, not ours: it may vanish.
        if (tts && typeof Howl === "function") {
            const howl = new Howl({ html5: true, src: tts })
            howl.play()
        }
    }

    async solveByTapping() {
        // This method clicks the correct button from an array of possible buttons in the order required.
        // It uses the "._3CBig" class to identify possible buttons.

        const specificTypeProblem = this.challengeInfo.challengeGeneratorIdentifier.specificType;
        const targetLanguage = this.challengeInfo.targetLanguage
        console.logger({targetLanguage, specificTypeProblem})
        let correctTokens = this.challengeInfo.correctTokens ?? this.challengeInfo.prompt?.split("") ?? this.challengeInfo.correctIndices.map(i => this.challengeInfo.choices[i].text);
        let wordBank = this.constructor.getElementsByDataTest("word-bank")[0];
        if (!wordBank) {
            window.console.logger("tapText: missing word-bank");
            return;
        }
        let firstButton = wordBank.querySelector("button");
        if (!firstButton) {
            window.console.logger("tapText: no buttons in word-bank");
            return;
        }
        let buttonUnpressedClasses = firstButton.classList.toString();
        const allPossibleButtons = Array.from(wordBank.querySelectorAll("button"));
        console.logger({allPossibleButtons, correctTokens})
        for (let token of correctTokens) {
            const avaibleButtons = allPossibleButtons.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            const tokensText = this.extractTextFromNodes(avaibleButtons);
            console.logger({avaibleButtons, tokensText})
            if (!tokensText[token]) {
                window.console.logger("tapText: missing token", token);
                return;
            }
            tokensText[token].click();
            if (['tap_gap', 'reverse_tap', 'listen_tap'].includes(specificTypeProblem)) {
                await sleep(200);
                const howl = window.Howler?._howls?.find(obj => obj.playing())
                if (howl) {
                    const duration = howl.duration()
                    const currentPos = howl.seek()
                    const remainingSeconds = duration - currentPos 
                    console.logger("playing audio", {duration, currentPos, remainingSeconds})
                    const silence = ['it', 'zh', 'fr'].includes(this.challengeInfo.targetLanguage) ? 900 : 200
                    await sleep(Math.max(200, (remainingSeconds * 1000) - silence));
                } else {
                    console.logger("Nothingn playing")
                    await sleep(1000);
                }
            }
        }
    }

    async solveCharacterMatch() {
        // This method clicks the correct button from two arrays of possible buttons in the order required.
        // It uses the "._33Jbm" class to identify possible buttons.x
        let optionsContainer = queryFirst(SELECTORS.matchContainer);
        if (!optionsContainer) return;
        let firstButton = optionsContainer.querySelector("button");
        if (!firstButton) {
            window.console.logger("match: no buttons in container");
            return;
        }
        let buttonUnpressedClasses = firstButton.classList.toString();

        let solutionPairs = this.challengeInfo.pairs;
        for (let pair of solutionPairs) {
            let allOptionsNodes = Array.from(optionsContainer.querySelectorAll("span"));
            let optionNodes = allOptionsNodes.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            let pairsNodeText = this.extractTextFromNodes(optionNodes);

            const first = pairsNodeText[pair.fromToken ?? pair.transliteration];
            const second = pairsNodeText[pair.learningToken ?? pair.character];
            if (!first || !second) {
                window.console.logger("match: missing pair button", pair);
                return;
            }
            first.click();
            await sleep();
            second.click();
            await sleep();
        }
    }
}
