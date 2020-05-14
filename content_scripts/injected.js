import ReactUtils from "./ReactUtils.js"
import DuolingoSkill from "./DuolingoSkill.js"

// these logs don't work for some reason :(
console.log("Welcome to Autolingo v1.0!")

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

const get_current_tier = () => {
    const league_state_node = document.getElementsByClassName("_1NIUo COg1x")[0];
    if (!league_state_node) {
        return;
    }
    const leageu_state = new ReactUtils().ReactInternal(league_state_node).return.return.return.return.stateNode.props.leagueState;
    return leageu_state.tier;
}

const tier_img_map = {
    0: "images/bronze-league.png",
    1: "images/silver-league.png",
    2: "images/gold-league.png",
    3: "images/sapphire-league.png",
    4: "images/ruby-league.png",
    5: "images/emerald-league.png",
    6: "images/amethyst-league.png",
    7: "images/pearl-league.png",
    8: "images/obsidian-league.png",
    9: "images/diamond-league.png"
}

const tier_img_url = `${extension_prefix}/${tier_img_map[get_current_tier()]}`

const inject_autolingo = () => {
    if (url_changed && window.location.href === "https://www.duolingo.com/learn") {
        url_changed = false;

        // iterate over all skills
        let all_skill_nodes = document.querySelectorAll("div[data-test='skill']");
        all_skill_nodes.forEach(skill_node => {

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

            // append a lil button to each skill
            // when clicked, this button starts an auto-lesson
            let start_autolingo_tooltip_text = document.createElement("SPAN");
            start_autolingo_tooltip_text.innerText = "Autocomplete lesson with AutoLingo.";
            start_autolingo_tooltip_text.className = "tooltip-text";

            // append nodes to eachother
            start_autolingo_skill_tooltip.appendChild(start_autolingo_tooltip_text);
            start_autolingo_skill_tooltip.appendChild(start_autolingo_skill);
            start_autolingo_skill_container.appendChild(start_autolingo_skill_tooltip);
            skill_node.appendChild(start_autolingo_skill_container);
        });
    }
}

