// // function for injecting a file as a script so we can use it
injectScript = (fileName) => {
    // append the content script as a script element to the page
    // so that it has proper permissions to modify video elements
    let th = document.getElementsByTagName('body')[0];
    let s = document.createElement('script');
    s.setAttribute('type', 'module');

    // set the source attribute for the injected script
    s.setAttribute('src', `chrome-extension://${chrome.runtime.id}/${fileName}`);
    th.appendChild(s);
}

// only inject our script if the extension is enabled
chrome.storage.local.get(
    "autolingo_enabled",
    (response) => {
        autolingo_enabled = response["autolingo_enabled"]
        if (autolingo_enabled) {
            // inject our web accessible resource into the page
            // so it can access the properties of web elements that we need.
            // idk why you have to inject it for this but you do
            injectScript("content_scripts/injected.js")
        }
    }
);

