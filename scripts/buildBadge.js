// Build id bridge (ISOLATED world, like displaySettings.js): reads the id
// buildStamp.js stored once, at page load, so it stays the id of the code
// this tab runs. styles/lesson.css shows it on the Solve button.
chrome.storage.local.get("alBuild").then(({ alBuild }) => {
    if (alBuild) document.documentElement.style.setProperty("--al-build", JSON.stringify(alBuild));
});
