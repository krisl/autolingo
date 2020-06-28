import ReactUtils from "./ReactUtils.js"

export default class DuolingoChallenge extends ReactUtils {
    constructor() {
        super();

        this.challenge_node = this.get_current_challenge();

        if (this.challenge_node) {
            this.learning_language = this.challenge_node.metadata.learning_language;
            this.source_language = this.challenge_node.metadata.from_language;
            this.target_language = this.challenge_node.metadata.source_language;

            this.challenge_type = this.challenge_node.metadata.type;
            this.challenge_id = this.challenge_node.metadata.uuid;

            this.click_next_count = 0;
            this.active_click_next = undefined;
        }
    }

    get_current_challenge = () => {
        const challenge_elem = this.ReactInternal(document.getElementsByClassName("_2vedk")[0]);
        if (challenge_elem) {
            return challenge_elem.return.return.stateNode.props.currentChallenge;
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
            case "form":
                this.solve_form();
                break;
            case "character_select":
                this.solve_character_select();
                break;
            case "listen_tap":
                this.solve_listen_tap();
                break;
            case "judge":
                this.solve_judge();
                break;
            case "select_transcription":
                this.solve_select_transcription();
                break;
            case "character_intro":
                this.solve_character_intro();
                break;
            case "select":
                this.solve_select();
                break;
            case "select_pronunciation":
                this.solve_select_pronunciation();
                break;
            case "complete_reverse_translation":
                this.solve_complete_reverse_translation();
                break;
            case "listen":
                this.solve_listen_tap();
                break;
            case "name":
                this.solve_name();
                break;
            default:
                let error_string = "UNKNOWN CHALLENGE TYPE: " + this.challenge_type;
                alert(error_string);
                throw new Error(error_string);
        }
    }

    insert_translation = (translation) => {
        let challenge_translate_input = document.querySelector("textarea[data-test='challenge-translate-input']");
        this.ReactInternal(challenge_translate_input).return.return.stateNode.props.onChange(null, translation)
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
        let answer = this.challenge_node.correctSolutions[0];
        let challenge_translate_input = document.querySelector("input[data-test='challenge-text-input']");
        this.ReactInternal(challenge_translate_input).return.stateNode.props.onChange({"target": {"value": answer}});
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

    // fill in the blank
    solve_form = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("label[data-test='challenge-choice']", correct_index);
    }
    
    solve_character_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("label[data-test='challenge-choice-card']", correct_index);
    }

    // mark the correct meaning
    solve_judge = () => {
        let correct_index = this.challenge_node.correctIndices[0];
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    // what do you hear?
    solve_select_transcription = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    // what sound does this make?
    solve_character_intro = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    // which one of these is "_____"?
    solve_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("label[data-test='challenge-choice-card']", correct_index);
    }

    // what do you hear?
    solve_select_pronunciation = () => {
        let correct_index = this.challenge_node.correctIndex;
        this.choose_index("div[data-test='challenge-judge-text']", correct_index);
    }

    // complete the translation
    solve_complete_reverse_translation = () => {
        let answer = this.challenge_node.displayTokens.find(token => { return token.isBlank; }).text;
        let challenge_translate_input = document.querySelector("input[data-test='challenge-text-input']");
        this.ReactInternal(challenge_translate_input).return.stateNode.props.onChange({"target": {"value": answer}});
    }

    choose_index = (query_selector, correct_index) => {
        let choices = document.querySelectorAll(query_selector);
        if (correct_index >= choices.length) {
            correct_index = choices.length - 1;
        }
        choices[correct_index].click()
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
        let click_next_interval = setInterval(() => {
            console.log('trying to click next...')
            let player_next_button = document.querySelector("button[data-test='player-next']")

            // if we can click the button...
            if (player_next_button && !player_next_button.disabled) {

                // click it! and decrease the count
                player_next_button.click();
                this.click_next_count--;

                // stop checking to click for THIS button
                clearInterval(click_next_interval);

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
}
