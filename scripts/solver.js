class DuolingoChallenge {
    constructor(pageData) {
        this.challengeInfo = pageData.currentChallenge;
        this.challengeToggleState = pageData.challengeToggleState
    }

    get isKeyboardEnabled() {
        // Parent object contains several information about current duolingo status;
        const pageData = window.getReactElement(document.querySelector("._3yE3H"))?.return?.return?.memoizedProps;
        let parentObject = pageData.challengeToggleState;
        const result = (parentObject.isToggledToTyping)
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

    // Methods for simulating user interaction.
    static clickButtonCheck() {
        this.getElementsByDataTest("player-next")[0].click();
    }

    static clickButtonContinue() {
        this.getElementsByDataTest("player-next")[0].click();
    }

    static clickButtonSkip() {
        this.getElementsByDataTest("player-skip")[0].click();
    }

    static insertText(textFieldDataTest, value) {
        let fieldText = this.getElementsByDataTest(textFieldDataTest)[0];
        window.getReactElement(fieldText)?.pendingProps?.onChange({ target: { value } });
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
                return () => this.solveSelectCorrectIndexTypeProblems();

            case "characterMatch":
            case "match":
                return () => this.solveCharacterMatch();
            
            case "read_comprehension":
            case "translate":
            case "listenTap":
            case "name":
                return () => this.isKeyboardEnabled ? this.solveWriteTextInSomeTextFieldTypeProblems() : this.solveTapTextTypeProblems();

            case "transliterate":
                return () => this.solveWriteTextInSomeTextFieldTypeProblems();

            case "tapComplete":
                return () => this.solveTapTextTypeProblems();
            //case "speak":
            //    await sleep();
            //    this.constructor.clickButtonSkip();
            //    break;

            //case "characterTrace":
            //case "characterWrite":
            //    alert("The extension can't solve this problem. Please do it manually and we'll be able to continue.");
            //    console.logger("Waiting for user interaction");
            //    break;

            case "listenComprehension":
            case "listenIsolation":
                return () => this.solveListenIsolation();

            case "listen":
                return () => this.writeTextInSpace();

            case "listenComplete":
                return () => this.solveFromNearbyElements();
            case "completeReverseTranslation":
                return () => this.isKeyboardEnabled ? this.solveWriteTextInSomeTextFieldTypeProblems() : this.solveFromNearbyElements();
            case "partialReverseTranslate":
                return () => this.solveFromNearbyElementsButForPartialReverseTranslate();

            //TODO: This is only commented because I don't have any problem to test it with
            // case "typeCloze":
            //     this.solveFromNearbyElementsButForTypeCloze();
            //     break;
        }
    }
    solveFromNearbyElementsButForPartialReverseTranslate() {
        const altCorrectAnswer = this.challengeInfo.displayTokens.filter(dt => dt.isBlank).map(dt => dt.text).join('')
        const correctAnswer = parent.document.querySelector(".Id-Wa").textContent
        window.console.logger({altCorrectAnswer, correctAnswer})
        window.console.logger(altCorrectAnswer === correctAnswer)

        const altInputElement = window.document.querySelector("[data-test='challenge challenge-partialReverseTranslate'] [contenteditable=true]")
        let inputElement = parent.document.querySelector(".tapBI");

        window.console.logger({altInputElement, inputElement})
        window.console.logger(altInputElement === inputElement)

        inputElement.textContent = correctAnswer;
    
        // Create a new 'input' event
        let event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });
    
        // Dispatch the event
        inputElement.dispatchEvent(event);
    }

    solveFromNearbyElementsButForTypeCloze() {
        let correctAnswer = parent.document.querySelector(".caPDQ").textContent
        //remove first character
        correctAnswer = correctAnswer.substring(1, correctAnswer.length);
        let inputElement = parent.document.querySelector(".Y5JxA._17nEt");
        inputElement.textContent = correctAnswer;

        // Create a new 'input' event
        let event = new Event('input', {
            bubbles: true,
            cancelable: true,
        });

        // Dispatch the event
        inputElement.dispatchEvent(event);
    } 

    solveFromNearbyElements() {
        const correctAnswer = this.challengeInfo.displayTokens.find(dt => dt.isBlank).text

        let textField = this.constructor.getElementsByDataTest("challenge-text-input")[0];
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: correctAnswer } });
    }

    async solveListenIsolation() {
        const buttons = parent.document.querySelectorAll(".ufykF");
        buttons[this.challengeInfo.correctIndex].click();
        await sleep();
    }

    writeTextInSpace() {
        let bestSolution = this.challengeInfo.challengeResponseTrackingProperties.best_solution;
        let textField = this.constructor.getElementsByDataTest("challenge-translate-input")[0];
        window.getReactElement(textField)?.pendingProps?.onChange({ target: { value: bestSolution } });
    }

    async solveSelectCorrectIndexTypeProblems() {
        // This method clicks the correct button from an array of possible buttons.
        // It uses the "data-test" attribute to identify possible buttons.
        const dataTestByChallengeType = {
            "characterIntro": "challenge-judge-text",
            "characterSelect": "challenge-choice",
            "selectPronunciation": "challenge-choice",
            "select": "challenge-choice",
            "assist": "challenge-choice",
            "gapFill": "challenge-choice",
            "dialogue": "challenge-choice",
            "readComprehension": "challenge-choice",
            "reverseAssist": "challenge-choice",
            "transliterationAssist": "challenge-choice"
        }

        let correctIndex = this.challengeInfo.correctIndex;
        let dataTest = dataTestByChallengeType[this.challengeInfo.type];
        this.constructor.getElementsByDataTest(dataTest)[correctIndex].click();
        await sleep();
    }
    
    async solveCorrectIndicesTypeProblems(){
        let solutions = this.challengeInfo.correctIndices;
        let wordBank = this.constructor.getElementsByDataTest("word-bank")[0];
        let options = this.constructor.getElementsByDataTest("challenge-tap-token-text", wordBank);
        for (let i = 0; i < solutions.length; i++){
            options[solutions[i]].click();
            await sleep();
        }
    }

    solveWriteTextInSomeTextFieldTypeProblems() {
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
                    alert("Unknown translate problem type: " + this.specificTranslateType);
                    throw new Error(this.specificTranslateType);
            }
        })();

        window.console.logger({solution, tts: this.challengeInfo.solutionTts});
        const dataTextByChallengeType = {
            "translate": "challenge-translate-input",
            "listenTap": "challenge-translate-input",
            "transliterate": "challenge-text-input",
            "name": "challenge-text-input",
            "type": "challenge-text-input",
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
        if (tts) {
            const howl = new Howl({ html5: true, src: tts })
            howl.play()
        }
    }

    async solveTapTextTypeProblems() {
        // This method clicks the correct button from an array of possible buttons in the order required.
        // It uses the "._3CBig" class to identify possible buttons.

        const specificTypeProblem = this.challengeInfo.challengeGeneratorIdentifier.specificType;
        const targetLanguage = this.challengeInfo.targetLanguage
        console.logger({targetLanguage, specificTypeProblem})
        let correctTokens = this.challengeInfo.correctTokens ?? this.challengeInfo.prompt?.split("") ?? this.challengeInfo.correctIndices.map(i => this.challengeInfo.choices[i].text);
        let wordBank = this.constructor.getElementsByDataTest("word-bank")[0];
        let buttonUnpressedClasses = wordBank.querySelector("button").classList.toString();
        const allPossibleButtons = Array.from(wordBank.querySelectorAll("button"));
        console.logger({allPossibleButtons, correctTokens})
        for (let token of correctTokens) {
            const avaibleButtons = allPossibleButtons.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            const tokensText = this.extractTextFromNodes(avaibleButtons);
            console.logger({avaibleButtons, tokensText})
            tokensText[token].click();
            if (['tap_gap', 'reverse_tap', 'listen_tap'].includes(specificTypeProblem)) {
                console.logger("H", Howler._howls)
                await sleep(200);
                const howl = Howler._howls.find(obj => obj.playing())
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
        let optionsContainer = document.querySelector("div[data-test*='challenge'] > div > div > div");
        let buttonUnpressedClasses = optionsContainer.querySelector("button").classList.toString();

        let solutionPairs = this.challengeInfo.pairs;
        for (let pair of solutionPairs) {
            let allOptionsNodes = Array.from(optionsContainer.querySelectorAll("span"));
            let optionNodes = allOptionsNodes.filter((e) => e.classList.toString() === buttonUnpressedClasses);
            let pairsNodeText = this.extractTextFromNodes(optionNodes);

            pairsNodeText[pair.fromToken ?? pair.transliteration].click();
            await sleep();
            pairsNodeText[pair.learningToken ?? pair.character].click();
            await sleep();
        }
    }
}
