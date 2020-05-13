var enabled = false;

const update_enabled_button = (value) => {
    const elem = document.getElementById("toggle-enabled-text");
    const input_switch = document.getElementById("toggle-enabled-input");

    if (value) {
        elem.innerText = "Enabled";
        input_switch.checked = true;
    } else {
        elem.innerText = "Disabled";
        input_switch.checked = false;
    }
}

const toggle_extension_enabled = () => {
    enabled = !enabled;
    chrome.storage.local.set({"autolingo_enabled": enabled});
    update_enabled_button(enabled);
}

const render_content = () => {
    // get content div
    let content_div = document.getElementById("content");

    content_div.innerHTML = `
        <div class="enabled-button-container">
            <label class="autolingo-switch">
                <input id="toggle-enabled-input" type="checkbox">
                <span class="autolingo-slider"></span>
            </label>
            <div id="toggle-enabled-text">Disabled</div>
        </div>
    `

    document.getElementById("toggle-enabled-input").onclick = toggle_extension_enabled;
    update_enabled_button(enabled);
}

// ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    // load if the extension was enabled from the cache
    chrome.storage.local.get(
        "autolingo_enabled",
        (response) => {
            let autolingo_enabled = response["autolingo_enabled"];
            enabled = Boolean(autolingo_enabled);
            render_content();
        }
    );
});
