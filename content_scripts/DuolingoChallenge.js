import ReactUtils from "./ReactUtils.js"

export default class DuolingoChallenge extends ReactUtils {
    constructor() {
        super();

        this.challenge_node = this.get_current_challenge();

        this.learning_language = this.challenge_node.metadata.learning_language;
        this.source_language = this.challenge_node.metadata.from_language;
        this.target_language = this.challenge_node.metadata.source_language;

        this.challenge_type = this.challenge_node.metadata.type;
        this.challenge_id = this.challenge_node.metadata.uuid;

        this.click_next_queue = [];
        this.active_click_next = undefined;
    }

    get_current_challenge = () => {
        return this.ReactInternal(document.getElementsByClassName("_2vedk")[0]).return.return.stateNode.props.currentChallenge
    }

    solve = () => {
        this.perform_solution();
        this.click_check();
        this.click_continue();
    }

    perform_solution = () => {
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
            default:
                break;
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
        document.querySelectorAll("label[data-test='challenge-choice']")[correct_index].click()
    }
    
    solve_character_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        document.querySelectorAll("label[data-test='challenge-choice-card']")[correct_index].click()
    }

    // mark the correct meaning
    solve_judge = () => {
        let correct_index = this.challenge_node.correctIndices[0];
        document.querySelectorAll("div[data-test='challenge-judge-text']")[correct_index].click()
    }

    // what do you hear?
    solve_select_transcription = () => {
        let correct_index = this.challenge_node.correctIndex;
        document.querySelectorAll("div[data-test='challenge-judge-text']")[correct_index].click()
    }

    // what sound does this make?
    solve_character_intro = () => {
        let correct_index = this.challenge_node.correctIndex;
        document.querySelectorAll("div[data-test='challenge-judge-text']")[correct_index].click()
    }

    // which one of these is "_____"?
    solve_select = () => {
        let correct_index = this.challenge_node.correctIndex;
        document.querySelectorAll("label[data-test='challenge-choice-card']")[correct_index].click()
    }

    // what do you hear?
    solve_select_pronunciation = () => {
        let correct_index = this.challenge_node.correctIndex;
        document.querySelectorAll("div[data-test='challenge-judge-text']")[correct_index].click()
    }

    click_check = () => {
        this.queue_click_player_next("CHECK");
    }

    click_continue = () => {
        this.queue_click_player_next("CONTINUE");
    }

    queue_click_player_next = (type) => {
        // if we're already handling a command, then push it onto the queue
        if (this.active_click_next) {
            this.click_next_queue.push(type);
        }

        // else handle this command
        else {
            this.click_player_next(type);
            this.active_click_next = type;
        }
    }

    click_player_next = (type) => {
        // keep trying to click the 'next' button until something happens
        let click_next_interval = setInterval(() => {
            let player_next_button = document.querySelector("button[data-test='player-next']")
            if (player_next_button) {
                // the text of the button, values can be "CHECK" or "CONTINUE"
                let button_state = player_next_button.innerText;
                
                // if our button is still in the original state, try to click again
                if (button_state === type) {
                    player_next_button.click();
                }

                // else we made it change!
                else {
                    clearInterval(click_next_interval);

                    // if we have more on the queue, start the next one!
                    if (this.click_next_queue.length > 0) {
                        let next_click = this.click_next_queue.shift();
                        this.active_click_next = next_click;
                        this.click_player_next(next_click);
                    }
                }
            }
        }, 1)
    }
}
