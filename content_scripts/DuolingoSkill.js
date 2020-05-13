import DuolingoChallenge from "./DuolingoChallenge.js"
import ReactUtils from "./ReactUtils.js"


export default class DuolingoSkill extends ReactUtils {
    constructor (skill_node) {
        super();

        this.skill_node = skill_node;
        this.skill_metadata = this.ReactInternal(skill_node).return.stateNode.props.skill;
    }

    start = () => {
        this.skill_node.children[0].click();
        document.querySelector("button[data-test='start-button']").click();

        this.state_machine = setInterval(this.complete_challenge, 10);
    }

    complete_challenge = () => {
        const status_node = document.getElementsByClassName("ZwSRm _1qXYl")[0];
        if (!status_node) { return; }

        const status = this.ReactInternal(status_node).return.return.stateNode.props.status
        throw new Error(status)

        switch (status) {
            // loading this lesson
            case "LOADING":
                break;
            // lil pop-up at the beginning of practice lessons
            case "SKILL_PRACTICE_SPLASH":
                // click START PRACTICE
                break;
            // lil pop-up at the beginning of the practice that you start by clicking
            // the weight icon in the bottom left
            case "GLOBAL_PRACTICE_SPLASH":
                break;
            // waiting for answer for this challenge
            case "GUESSING":
                break;
            // grading this challenge
            case "BLAMING":
                break;
            // loading next challenge
            case "SLIDING":
                break;
            // loading coach duo to give advice
            case "COACH_DUO_SLIDING":
                break;
            // waiting to hit CONTINUE for coach duo's advice
            // NOTE it's called "DOACH_DUO" but i think it's a typo so i put an extra case
            // here just in case they fix it
            case "DOACH_DUO":
            case "COACH_DUO":
                break;
            // just finished the lesson, loading results
            case "SUBMITTING":
                break;
            // results are here!
            case "END_CAROUSEL":
                break;
            default:
                alert("UNKNOWN STATUS: " + status)
                break;
        }
    }
}