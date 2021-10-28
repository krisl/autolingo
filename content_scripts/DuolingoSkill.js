import DuolingoChallenge from "./DuolingoChallenge.js"
import ReactUtils from "./ReactUtils.js"


export default class DuolingoSkill extends ReactUtils {
    constructor (skill_node) {
        super();

        this.skill_node = skill_node;
    }

    start = (start_button_selector) => {
        this.skill_node.children[0]?.click();
        document.querySelector(`[data-test='${start_button_selector}']`)?.click();

        this.state_machine = setInterval(this.complete_challenge, 10);
    }

    end () {
        clearInterval(this.state_machine);
        this.current_challenge.end();
        console.logger("Lesson complete, stopping the autocompleter!");
    }

    complete_challenge = () => {
        // if you're on the home page, stop trying to complete the skill
        if (window.location.href.includes("duolingo.com/learn")) {
            this.end();
            return;
        }

        // else try to find the status and act accordingly
        const status_node = document.getElementsByClassName("mQ0GW")[0];
        if (!status_node) {
            console.logger("can't find status node!");
            return;
        }

        const status = this.ReactFiber(status_node).return.return.stateNode.props.player.status;

        switch (status) {
            // loading this lesson
            case "LOADING":
                break;
            // lil pop-up at the beginning of practice lessons
            case "SKILL_PRACTICE_SPLASH":
            case "CHECKPOINT_TEST_SPLASH":
                // click START PRACTICE
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // lil pop-up at the beginning of the practice that you start by clicking
            // the weight icon in the bottom left
            case "GLOBAL_PRACTICE_SPLASH":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // waiting for answer for this challenge
            case "GUESSING":
                this.current_challenge = new DuolingoChallenge();
                try {
                    this.current_challenge.solve();
                } catch (error) {
                    console.logger(error);
                }
                this.current_challenge.click_next();
                this.current_challenge.click_next();
                break;
            // showing the question before you can actually answer it
            case "SHOWING":
                break;
            // grading this challenge
            case "BLAMING":
                break;
            case "GRADING":
                break;
            // loading next challenge
            case "SLIDING":
                break;
            // loading coach duo to give advice
            case "COACH_DUO_SLIDING":
            case "HARD_MODE_DUO_SLIDING":
                break;
            // waiting to hit CONTINUE for coach duo's advice
            // NOTE it's called "DOACH_DUO" but i think it's a typo so i put an extra case
            // here just in case they fix it
            case "DOACH_DUO":
            case "COACH_DUO":
            case "HARD_MODE_DUO":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // just finished the lesson, loading results
            case "COACH_DUO_SUBMITTING":
            case "SUBMITTING":
                break;
            // results are here!
            case "END_CAROUSEL":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                this.current_challenge.click_next();
                this.current_challenge.click_next();
                break;
            // little ad that pops up
            case "PLUS_AD":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // when they give you a little info before the lesson
            case "PRE_LESSON_TIP_SPLASH":
            case "GRAMMAR_SKILL_SPLASH":
                document.querySelector("[data-test=player-next]")?.click();
                Array.from(document.querySelectorAll("span")).forEach(e => {
                    if (e.innerText.toLowerCase().includes("start lesson")) {
                        e?.click();
                    }
                });
                break;
            default:
                alert("UNKNOWN STATUS: " + status);
                this.end();
                break;
        }
    }
}