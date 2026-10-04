// This code get executed when a lesson like page is loaded.
// It execute all the solver related code.

// True while a solver runs: a second Solve click (or autosolve) would replay
// the answer on top, e.g. redraw every trace stroke and lose hearts.
let autolingoSolving = false;

window.addEventListener("LessonStatusChanged", async function ({ detail: pageData }) {
    const playerStatus = pageData.player?.status
    console.logger("currentStatus: " + playerStatus);
    if (playerStatus !== "GUESSING") return;
            const currentChallange = new DuolingoChallenge(pageData);
            currentChallange.printDebugInfo();
	  window.console.logger('hi', {pageData})
            const solve = currentChallange.get_async_solver();
            const handleSolve = async () => {
                if (autolingoSolving) {
                    console.logger("already solving, ignoring click");
                    return;
                }
                currentChallange.printDebugInfo();
                if (!solve) {
                    alert("Unknown problem type: " + currentChallange.challengeInfo.type);
                    throw new Error(currentChallange.challengeInfo.type)
                }
                autolingoSolving = true;
                try {
                    await solve();
                    await sleep();
                } finally {
                    autolingoSolving = false;
                }
                //DuolingoChallenge.clickButtonCheck();
            }

            // Insert button for solve this problem.
            const footer = queryFirst(SELECTORS.footer);
            if (!footer) {
                window.console.logger("no footer, skipping solve button");
            } else {
            footer.classList.add("autolingo-footer-div");
            //footer.classList.add(className);
            // remove any old buttons
            footer.querySelector("button.autolingo-solve")?.remove()
            footer.querySelector("div.autolingo-buttonsection")?.remove()
            if (!solve) {
                window.console.logger("cant solve " + currentChallange.challengeInfo.type)
            } else
            if (!footer.querySelector("button.autolingo-solve")) {
                const sourceButton = queryFirst(SELECTORS.playerNext, footer);
                if (!sourceButton) {
                    window.console.logger("no player-next button to clone");
                } else {
                //FIXME just make our own button
                const button = sourceButton.cloneNode(true);
                button.removeAttribute("data-test") // dont accidentally click button
                button.classList.remove("_2wryV") // ensure button is green
                button.classList.remove("_2oGJR") // ensure button is blue
    
                if (button.childNodes[0]) button.childNodes[0].innerText = "Solve"
                button.classList.add("autolingo-solve");
                button.addEventListener("click", handleSolve);
                // outer div classes when 3 child elements class="U8jH3 jHbiF"
                const footerRow = footer.querySelector("div");
                let checkButtonSection = footerRow && queryFirst(SELECTORS.buttonSection, footerRow, true);
                if (!checkButtonSection) {
                    window.console.logger("creating a new button section")
                    checkButtonSection = document.createElement('div')
                    checkButtonSection.classList.add("autolingo-buttonsection");
                    footer.querySelector("div")?.prepend(checkButtonSection);
                }

                if (checkButtonSection) checkButtonSection.appendChild(button);

                //footer["autolingo_solve_button_inserted"] = true;
                console.logger("Footer button was inserted");
                }
            }
            } // end else (footer present)
})
