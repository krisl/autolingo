var enabled = false;
var matching_enabled = false;

const update_slider = (node_id, text_id, enabled_text, disabled_text, value) => {
    const input_switch = document.getElementById(node_id);
    const text_elem = document.getElementById(text_id);

    if (value) {
        text_elem.innerText = enabled_text;
        input_switch.checked = true;
    } else {
        text_elem.innerText = disabled_text;
        input_switch.checked = false;
    }
}

const update_enabled_slider = (value) => {
    update_slider(
        "toggle-enabled-input", "toggle-enabled-text",
        "Enabled", "Disabled",
        value
    );
}

const update_matching_slider = (value) => {
    update_slider(
        "toggle-matching-input", "toggle-matching-text",
        "Autocomplete Matching On", "Autocomplete Matching Off",
        value
    );
}

const toggle_extension_enabled = () => {
    enabled = !enabled;
    chrome.storage.local.set({"autolingo_enabled": enabled});
    update_enabled_slider(enabled);
}

const toggle_matching_enabled = () => {
    matching_enabled = !matching_enabled;
    chrome.storage.local.set({"autolingo_matching_enabled": matching_enabled});
    update_matching_slider(matching_enabled);
    update_autocomplete_matching_value(matching_enabled);
}

const complete_challenge = () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "complete_challenge"});  
    });
}

const update_autocomplete_matching_value = (value) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: "autocomplete_matching", data: value});  
    });
}

const render_content = () => {
    // get content div
    let content_div = document.getElementById("content");

    content_div.innerHTML = `
        <div class="slider-container content-row">
            <label class="autolingo-switch">
                <input id="toggle-enabled-input" type="checkbox">
                <span class="autolingo-slider"></span>
            </label>
            <div id="toggle-enabled-text">Disabled</div>
        </div>
        <div class="slider-container content-row">
            <label class="autolingo-switch">
                <input id="toggle-matching-input" type="checkbox">
                <span class="autolingo-slider"></span>
            </label>
            <div id="toggle-matching-text">Complete Matching</div>
        </div>
        <div class="complete-challenge-container content-row">
            <button id="complete-challenge-button">Complete Current Challenge</button>
        </div>
    `

    document.getElementById("toggle-enabled-input").onclick = toggle_extension_enabled;
    update_enabled_slider(enabled);

    document.getElementById("toggle-matching-input").onclick = toggle_matching_enabled;
    update_matching_slider(matching_enabled);

    document.getElementById("complete-challenge-button").onclick = complete_challenge;
}

// ON LOAD
document.addEventListener("DOMContentLoaded", () => {
    // load if the extension was enabled from the cache
    chrome.storage.local.get(
        "autolingo_enabled",
        (response) => {
            let autolingo_enabled = response["autolingo_enabled"];
            enabled = Boolean(autolingo_enabled);

            // load if autocomplete matching is enabled
            chrome.storage.local.get(
                "autolingo_matching_enabled",
                (response) => {
                    let autolingo_matching_enabled = response["autolingo_matching_enabled"];
                    matching_enabled = Boolean(autolingo_matching_enabled);
                    render_content();

                    // send value to injected script
                    update_autocomplete_matching_value(matching_enabled);
                }
            );

        }
    );
});
