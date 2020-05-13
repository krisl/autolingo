import ReactUtils from "./ReactUtils.js"
import DuolingoSkill from "./DuolingoSkill.js"

// these logs don't work for some reason :(
console.log("Welcome to Autolingo v1.0!")

// load utils
let react_utils = new ReactUtils();

// TODO don't hardcode this
let extension_prefix = "chrome-extension://nlimkebhpbkhknpabglehaekdonbkppc"

// inject stylesheet
let stylesheet = document.createElement("LINK");
stylesheet.setAttribute("rel", "stylesheet")
stylesheet.setAttribute("type", "text/css")
stylesheet.setAttribute("href", `${extension_prefix}/content_scripts/main.css`)
document.body.appendChild(stylesheet)

// iterate over all skills
let all_skill_nodes = document.querySelectorAll("div[data-test='skill']");
all_skill_nodes.forEach(skill_node => {
    // container to center the children
    let start_autolingo_skill_container = document.createElement("DIV");
    start_autolingo_skill_container.className = "start-autolingo-skill-container";

    // append a lil button to each skill
    // when clicked, this button starts an auto-lesson
    let start_autolingo_skill = document.createElement("IMG");
    start_autolingo_skill.src = `${extension_prefix}/images/diamond-league.png`;
    start_autolingo_skill.className = "start-autolingo-skill";

    // on click, start the lesson and let the extension know it's time to autocomplete
    start_autolingo_skill.onclick = () => {
        let ds = new DuolingoSkill(skill_node);
        ds.start();
    }

    // append them all
    // start_autolingo_skill_container.appendChild(start_autolingo_skill_bg);
    start_autolingo_skill_container.appendChild(start_autolingo_skill);
    skill_node.appendChild(start_autolingo_skill_container);
});
