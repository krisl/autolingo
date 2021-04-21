import ReactUtils from "./ReactUtils.js"

export default class DuolingoChallenge extends ReactUtils {
    constructor() {
        super();

        // get the react internals for the current lesson
        this.challenge_internals = this.get_challenge_internals();
        console.logger(this.challenge_internals);

        // make sure the keyboard is enabled so we can paste in the input box
        if (!this.challenge_internals.browserSettings.typingEnabled) {
            const enable_typing_node = Array.from(document.querySelectorAll("div")).find(e => {
                return e.innerHTML.toLowerCase() === "use keyboard"
            });

            if (enable_typing_node) {
                enable_typing_node.click();
            }
        }

        // get the react internals for the current challenge
        this.challenge_node = this.challenge_internals.currentChallenge;

        if (this.challenge_internals && this.challenge_node) {
            this.learning_language = this.challenge_node.metadata.learning_language;
            this.source_language = this.challenge_node.metadata.from_language;
            this.target_language = this.challenge_node.metadata.source_language;

            this.challenge_type = this.challenge_node.metadata.type;
            this.challenge_id = this.challenge_node.metadata.uuid;

            this.click_next_count = 0;
            this.active_click_next = undefined;
        }
    }

    get_challenge_internals = () => {
        const challenge_elem = this.ReactFiber(document.querySelector(".mQ0GW"));
        if (challenge_elem) {
            return challenge_elem.return.return.stateNode.props;
        }
    }

    solve = () => {
        switch (this.challenge_type) {
            case "character_match":
                this.solve_character_match();
                break;
            case "translate":
                this.solve_translate();
                break;
            // fill in the blank
            case "form":
                this.solve_form();
                break;
            case "character_select":
                this.solve_character_select();
                break;
            case "listen_tap":
                this.solve_listen_tap();
                break;
            // mark the correct meaning
            case "judge":
                this.solve_judge();
                break;
            // what do you hear?
            case "select_transcription":
                this.solve_select_transcription();
                break;
            // what sound does this make?
            case "character_intro":
                this.solve_select_transcription();
                break;
            // which one of these is "_____"?
            case "select":
                this.solve_select();
                break;
            // what do you hear?
            case "select_pronunciation":
                this.solve_select_transcription();
                break;
            // complete the translation
            case "complete_reverse_translation":
                this.solve_complete_reverse_translation();
                break;
            case "listen":
                this.solve_listen_tap();
                break;
            case "name":
                this.solve_name();
                break;
            case "gap_fill":
                this.solve_form();
                break;
            // fill in the blanks (in the table)
            case "tap_complete_table":
                this.solve_tap_complete_table();
                break;
            case "type_complete_table":
                this.solve_type_complete_table();
                break;
            case "type_cloze_table":
                this.solve_type_complete_table();
                break;
            case "type_cloze":
                this.solve_type_complete_table();
                break;
            case "tap_cloze_table":
                this.solve_tap_cloze_table();
            case "tap_cloze":
                this.solve_tap_cloze();
                break;
            case "tap_complete":
                this.solve_tap_compelete();
                break;
            case "read_comprehension":
                this.solve_form();
                break;
            case "listen_comprehension":
                this.solve_select_transcription();
                break;
            // complete the chat
            case "dialogue":
                this.click_next();
                this.click_next();
                this.solve_select_transcription();
                break;
            // speak this sentence
            case "speak":
                this.skip_speak();
                break;
            default:
                let error_string = `AUTOLINGO - UNKNOWN CHALLENGE TYPE: ${this.challenge_type}`;
                alert(error_string);
                throw new Error(error_string);
        }
    }

    skip_speak () {
        document.querySelector("[data-test='player-skip']")?.click()
    }

    insert_translation = (translation) => {
        let challenge_translate_input = document.querySelector("textarea[data-test='challenge-translate-input']");
        this.ReactFiber(challenge_translate_input).return.return.stateNode.props.onChange(null, translation)
    }

    // target to source AND source to target translations
    solve_translate = () => {
        let translation = this.challenge_node.correctSolutions[0];
        this.insert_translation(translation);
    }

    solve_listen_tap = () => {
        let translation = this.challenge_node.prompt;
        this.insert_translation(translation);
    }

    solve_name = () => {
        const answer = this.challenge_node.correctSolutions[0];
        
        const articles = this.challenge_node.articles;
        let answer_text;

        // if there are articles, find which article is the right one
        // and click it and remove it from the answer
        if (articles) {
            const correct_article = articles.find(article => {
                return answer.startsWith(article);
            });

            // select the correct article
            Array.from(document.querySelectorAll("div[data-test='challenge-judge-text']")).find(e => {
                return e.innerHTML === correct_article;
            }).click();

            // get the answer without the article and enter it
            answer_text = answer.replace(correct_article, "");
        }
        // if there are no articles, just write the text
        else {
            answer_text = answer;
        }

        let challenge_translate_input = document.querySelector("input[data-test='challenge-text-input']");
        this.ReactFiber(challenge_translate_input).return.stateNode.props.onChange({"target": {"value": answer_text}});
    }

    solve_tap_complete_table = () => {
        const tokens = this.challenge_node.displayTableTokens;

        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("button[data-test='challenge-tap-token']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each cell in the table, see if there is a matching choice for the right answer
        // if there is, then click on that choice
        // this will ensure that we've clicked the answers in the right order
        tokens.forEach(row => {
            row.forEach(cell => {
                cell = cell[0];
                if (cell.isBlank) {
                    const matching_choice = tap_tokens[cell.text];
                    if (matching_choice) {
                        matching_choice.click();
                    }
                }
            });
        });
    }

    solve_type_complete_table = () => {
        const blank_inputs = document.querySelectorAll("input[type=text]");
        blank_inputs.forEach(input => {
            const fiber = this.ReactFiber(input);
            const answer_token = fiber.return.return.return.return.pendingProps;
            const answer = answer_token.fullText.substring(answer_token.damageStart);
            fiber.pendingProps.onChange({"target": {"value": answer}});
        });
    }

    solve_tap_cloze_table = () => {
        const tokens = this.challenge_node.displayTableTokens;

        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("button[data-test='challenge-tap-token']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each cell in the table, see if there is a matching choice for the right answer
        // if there is, then click on that choice
        // this will ensure that we've clicked the answers in the right order
        tokens.forEach(row => {
            row.forEach(cell => {
                cell = cell[0];                
                if (cell.damageStart !== undefined) {
                    const answer = cell.text.substring(cell.damageStart);
                    const matching_choice = tap_tokens[answer];
                    if (matching_choice) {
                        matching_choice.click();
                    }
                }
            });
        });
    }

    // matching pairs
    solve_character_match = () => {
        let pairs = this.challenge_node.pairs;

        // get the nodes for all the options
        let tap_token_nodes = document.querySelectorAll("button[data-test='challenge-tap-token']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        })

        // for each pair, click both tokens
        pairs.forEach(pair => {
            tap_tokens[pair.character].click();
            tap_tokens[pair.transliteration].click();
        })
    }

    solve_form = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-choice']", correct_index);
    }
    
    solve_character_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-choice-card']", correct_index);
    }

    solve_judge = () => {
        let correct_index = this.challenge_node.correctIndices[0];
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    solve_select_transcription = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    solve_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-choice-card']", correct_index);
    }

    solve_complete_reverse_translation = () => {
        let challenge_translate_inputs = Array.from(document.querySelectorAll("input[data-test='challenge-text-input']"));

        this.challenge_node.displayTokens.forEach(token => {
            if (token.isBlank) {
                const answer = token.text;
                const challenge_translate_input = challenge_translate_inputs.shift();
                this.ReactFiber(challenge_translate_input).return.stateNode.props.onChange({"target": {"value": answer}});
            }
        });
    }

    solve_tap_cloze = () => {
        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("button[data-test='challenge-tap-token']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each token
        this.challenge_node.displayTokens.forEach(answer_token => {
            // if it requires an answer
            if (answer_token.damageStart !== undefined) {
                // get the text for the answer
                let answer = answer_token.text.substring(answer_token.damageStart);

                // and click the right tap token
                tap_tokens[answer].click();
            };
        });
    }

    solve_tap_compelete = () => {
        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("button[data-test='challenge-tap-token']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // click on the right answers in the right order
        this.challenge_node.displayTokens.forEach(token => {
            if (token.isBlank) {
                tap_tokens[token.text].click();
            }
        });
    }

    choose_index = (query_selector, correct_index) => {
        let choices = document.querySelectorAll(query_selector);
        if (correct_index >= choices.length) {
            correct_index = choices.length - 1;
        }

        choices[correct_index].click();
    }

    click_next = () => {
        // increase the count
        this.click_next_count++;

        // if we're not handling a click-next, handle this one!
        if (!this.active_click_next) {
            this.set_click_next_interval();
            this.active_click_next = true;
        }
    }

    set_click_next_interval = () => {
        // keep trying to click the 'next' button until something happens
        this.click_next_interval = setInterval(() => {
            // console.logger('trying to click next...')
            let player_next_button = document.querySelector("button[data-test='player-next']")

            // if we can click the button...
            if (player_next_button && !player_next_button.disabled) {

                // click it! and decrease the count
                player_next_button.click();
                this.click_next_count--;

                // stop checking to click for THIS button
                clearInterval(this.click_next_interval);

                // if we have more to click, start the next one!
                if (this.click_next_count > 0) {
                    this.active_click_next = true;
                    this.set_click_next_interval();
                } else {
                    this.active_click_next = false;
                }
            }
        }, 1)
    }

    // clean-up: end the active intervals
    end () {
        if (this.click_next_interval) {
            clearInterval(this.click_next_interval);
        }
    }
}
