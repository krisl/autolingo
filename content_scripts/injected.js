import ReactUtils from "./ReactUtils.js"
import DuolingoSkill from "./DuolingoSkill.js"
import DuolingoChallenge from "./DuolingoChallenge.js"

// RE-ENABLE LOGGING TO CONSOLE
const frame = document.createElement('iframe');
document.body.appendChild(frame);
const log = (content) => {
    frame.contentWindow.console.log(content);
}

// this restores ALL functionality to the console
// console = frame.contentWindow.console;

log("Welcome to Autolingo v1.0!")

// re-inject the code whenever the url changes back to duolingo.com/learn
let current_location = window.location.href;
let url_changed = true;
setInterval(() => {
    if (current_location !== window.location.href) {
        url_changed = true;
    }
}, 1)

// TODO don't hardcode this
let extension_prefix = "chrome-extension://nlimkebhpbkhknpabglehaekdonbkppc"

// inject stylesheet
let stylesheet = document.createElement("LINK");
stylesheet.setAttribute("rel", "stylesheet")
stylesheet.setAttribute("type", "text/css")
stylesheet.setAttribute("href", `${extension_prefix}/content_scripts/main.css`)
document.body.appendChild(stylesheet)
stylesheet.onload = () => {
    setInterval(inject_autolingo, 50);
}

document.addEventListener("complete_challenge", () => {
    const challenge = new DuolingoChallenge();
    challenge.solve();
    challenge.click_next();
    challenge.click_next();
});

const tier_img_url = `${extension_prefix}/images/diamond-league.png`

const inject_autolingo = () => {
    if (url_changed && window.location.href === "https://www.duolingo.com/learn") {
        url_changed = false;

        // iterate over all skills
        let all_skill_nodes = document.querySelectorAll("div[data-test='skill']");
        all_skill_nodes.forEach(skill_node => {

            // only add these buttons to unlocked lessons
            const unlocked = new ReactUtils().ReactInternal(skill_node).return.stateNode.props.skill.accessible;
            if (unlocked) {

                // add start skill button with tooltip to a container DIV
                let start_autolingo_skill_container = document.createElement("DIV");
                start_autolingo_skill_container.className = "start-autolingo-skill-container";

                let start_autolingo_skill_tooltip = document.createElement("DIV");
                start_autolingo_skill_tooltip.className = "tooltip";

                // append a lil button to each skill
                // when clicked, this button starts an auto-lesson
                let start_autolingo_skill = document.createElement("IMG");
                start_autolingo_skill.src = tier_img_url;
                start_autolingo_skill.className = "start-autolingo-skill";

                // on click, start the lesson and let the extension know it's time to autocomplete
                start_autolingo_skill.onclick = () => {
                    let ds = new DuolingoSkill(skill_node);
                    ds.start();
                }

                // show tooltip when hovering over the auto-lesson buttons
                let start_autolingo_tooltip_text = document.createElement("SPAN");
                start_autolingo_tooltip_text.innerText = "Autocomplete lesson with AutoLingo.";
                start_autolingo_tooltip_text.className = "tooltip-text";

                // append nodes to eachother
                start_autolingo_skill_tooltip.appendChild(start_autolingo_tooltip_text);
                start_autolingo_skill_tooltip.appendChild(start_autolingo_skill);
                start_autolingo_skill_container.appendChild(start_autolingo_skill_tooltip);
                skill_node.appendChild(start_autolingo_skill_container);
            }
        });
    }
}

