// This code get executed when a lesson like page is loaded.
// It execute all the solver related code.

window.addEventListener("LessonStatusChanged", async function ({ detail: pageData }) {
    const playerStatus = pageData.player?.status
    console.logger("currentStatus: " + playerStatus);
    switch (playerStatus) {
        case "GUESSING":
            const currentChallange = new DuolingoChallenge(pageData);
            currentChallange.printDebugInfo();
	  window.console.logger('hi', {pageData})
            const solve = currentChallange.get_async_solver();
            const handleSolve = async () => {
                currentChallange.printDebugInfo();
                if (!solve) {
                    alert("Unknown problem type: " + currentChallange.challengeInfo.type);
                    throw new Error(currentChallange.challengeInfo.type)
                }
                await solve();

                await sleep();
                //DuolingoChallenge.clickButtonCheck();
            }

            function handleAutosolveRequest() {
                confirm("Relaod page for start the autosolving?") ? location.assign(location.pathname + "?autosolve=true") : null;
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
                let checkButtonSection = footer.querySelector("div")?.querySelector("div._3h0lA");
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

            if (document.location.search.includes("autosolve")) { await sleep(); handleSolve() };
            break;

        case "BLAMING":
        case "COACH_DUO":
        case "HARD_MODE_DUO":
        case "LEGENDARY_DUO":
        case "PARTIAL_XP_DUO":
        case "CAPSTONE_REVIEW_SPLASH":
        case "COACH_DUO_SPLASH":
        case "VISIBLE_PERSONALIZATION_SPLASH":
        case "PLACEMENT_SPLASH":
        case "UNIT_TEST_SPLASH":
            if (document.location.search.includes("autosolve")) { await sleep(); DuolingoChallenge.clickButtonContinue() };
            break;

        case "COACH_DUO_SLIDING":
        case "SLIDING":
        case "HARD_MODE_DUO_SLIDING":
        case "SUBMITTING":
        case "PARTIAL_XP_DUO_SLIDING":
        case "GRADING":
            console.logger("Waiting...");
            break;

        case "END_CAROUSEL":
            const urlObject = new URL(document.location);
            if (urlObject.search.includes("repeat")) { 
                const value = urlObject.searchParams.get("repeat");
                if(!value || isNaN(Number(value))){ await sleep(); location.reload() };
                if(Number(value) > 0){ await sleep(); location.assign(location.pathname + "?autosolve&repeat=" + (Number(value) - 1)) };
            };
            break;

        default:
            console.logger("Unknown lesson status: " + playerStatus);
    }
})
