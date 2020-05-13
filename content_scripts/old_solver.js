// -----------------------------------------------------------
// ---------------- DUOLINGO LESSON COMPLETER ----------------
// -----------------------------------------------------------

// TODO:
// -- main "controller" tab that completes bare minimum strategy
// -- when this controller completes a lesson to its bare minimum, it opens a new tab:
// -------- this new tab complets the lesson until it is maxed out and then closes
// NEED TO FIGURE OUT HOW TO TELL THE NEW TAB TO ONLY COMPLETE THAT LESSON




/*
The following spaghetti code was written by Kristofer Brethower (unless otherwise specified).
It's intended purpose is for completing and maxing out your skill tree and
lessons in the Duolingo web application.

HOW TO USE:
1. Download the following chrome extension
  -- Name:    Custom JavaScript for websites
  -- Author:  hromada.dan
  -- Link:    https://chrome.google.com/webstore/detail/custom-javascript-for-web/poakhlngfciodnhlhhgnaaelnpjljija/related?hl=en

2. Paste the following code into the extension and click 'SAVE
3. Disable any pop-up disablers / enable duolingo.com to always generate tabs
4. The page should automatically restart and begin completing lessons

ADDITIONAL INFO:
You can change the logging of debug information in the console using 'debugLogEnabled'
the saving of lesson data to file using 'saveAndClearLessonDataAfterEachLesson'
and the lesson completion stragies (in what order it does the lessons).

*/



// **** GET SOLUTIONS FROM REACT NODE *****
// ReactInternal(document.getElementsByClassName("_2vedk")[0]).return.return.stateNode.props.currentChallenge

// ReactInternal(document.querySelector("textarea[data-test='challenge-translate-input']")).return.return.stateNode.props.onChange(null, "test")

// --------------------------------------------------
// ---------------- GLOBAL VARIABLES ----------------
// --------------------------------------------------

let duolingoAIEnabled = true;
let fakedLastAnswer = false;
let debugLogEnabled = false;
let stepEvery = 100;

let saveAndClearLessonDataAfterEachLesson = true;
let lessonNumber = undefined;
let lessonName = '';

let createdTabsForTheseSkills = {};
const maximumOpenTabs = 5;
let currentlyOpenTabs = 1;

// Skill Tree Completion Strategies:
// bare-minimum:               complete the bare minimum of each lesson required to advance
// max-out:                    max out each lesson before progressing to the next
// bare-minimum-then-max-out:  complete bare minimum, then max out starting with the last lesson
let skillTreeCompletionStrategy = 'bare-minimum';

const setStrategyToMaxOut = () => {
  skillTreeCompletionStrategy = 'max-out';
}

const setStrategyToBareMinimum = () => {
  skillTreeCompletionStrategy = 'bare-minimum';
}

const setStrategyToBareMinimumThenMaxOut = () => {
  skillTreeCompletionStrategy = 'bare-minimum-then-max-out';
}

// --------------------------------------------------
// ---------------- DOM MANIPULATION ----------------
// --------------------------------------------------

// retrieves the DOM object corresponding to the given HTML element
// -- credit to user 'Venryx' for this code on StackOverflow
// -- https://stackoverflow.com/questions/29321742/react-getting-a-component-from-a-dom-element-for-debugging
window.FindReact = function(dom) {
    let key = Object.keys(dom).find(key=>key.startsWith("__reactInternalInstance$"));
    let internalInstance = dom[key];
    if (internalInstance == null) return null;

    if (internalInstance.return) { // react 16+
        return internalInstance._debugOwner
            ? internalInstance._debugOwner.stateNode
            : internalInstance.return.stateNode;
    } else { // react <16
        return internalInstance._currentElement._owner._instance;
    }
}

// ---------------------------------------------------
// ---------------- TAB MANIPULATION  ----------------
// ---------------------------------------------------

// add property and value pair to the "external" property of the new window that you are creating
// TODO wtf is going on here i actually have no idea why it won't just make the windows
const openNewTabWithExtenalValue = (value) => {
	const win = window.open(' ');
  if (win) {
    win.focus();
    win.onload = () => { win.external.skillToComplete = value; };
  } else {
    console.debug('opening new tab didnt work');
  }
}

// create new tab for skill number 'n' in the skill tree
const openNewTabForSkill = (skillId) => {
  openNewTabWithExtenalValue(skillId);
}

const closeTab = () => {
  window.close();
}

const getSkillToComplete = () => {
  return window.external.skillToComplete;
}

// ---------------------------------------------
// ---------------- ANSWER DATA ----------------
// ---------------------------------------------

// initialize object containing the data for the answers
let answerData = {};

// initialize answerData mappings for the current language
const initializeLanguageAnswerData = () => {

  const language = getLanguage();

  if (!answerData[language]) {
    answerData[language] = {};
    answerData[language]['short-text'] = {};
    answerData[language]['text'] = {};
    answerData[language]['text-reverse'] = {};
    answerData[language]['sound'] = {};
    answerData[language]['pictures'] = {};
    answerData[language]['characters'] = {};
    answerData[language]['meaning'] = {};
    answerData[language]['pairs'] = {};
    answerData[language]['missing-word'] = {};
    answerData[language]['complete-translation'] = {};
  }
}

// save object data from browser console to file
// -- credit to user 'ollieglass' for their post on CoderWall
// -- https://coderwall.com/p/prhwzg/add-console-save-to-chrome
console.save = (data, filename) => {
    if (!data) {
        console.error('Console.save: No data')
        return;
    }

    if (!filename) filename = 'story.json'

    if (typeof data === "object") {
        data = JSON.stringify(data, undefined, 4);
    }


    var blob = new Blob([data], {
            type: 'text/json'
        }),
        e = document.createEvent('MouseEvents'),
        a = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

const save = () => {
  console.save(answerData, 'answerData.json');
}

// ----------------------------------------------------
// ---------------- PRINTING UTILITIES ----------------
// ----------------------------------------------------

// print a message to the console if we have debug logs enabled
const cPrint = (message, forcePrint) => {
  if (debugLogEnabled || forcePrint) { console.debug(message); }
}

// print a message to the console if we have debug logs enabled
const cPrintColor = (message, consoleBackground, consoleColor, forcePrint) => {
  if (debugLogEnabled || forcePrint) { console.debug('%c' + message, 'background: ' + consoleBackground + '; color: ' + consoleColor); }
}

// gets the current time as a String (e.g. "Sat May 18 2019 18:47:23")
const getCurrentTime = () => {
  return Date().substring(0, 24);
}

const calcMaxLessons = (lessonItemProps) => {
  return lessonItemProps.lessons * 12;
}

const getLessonItemProps = (lessonItem) => {
  return FindReact(lessonItem).props.children.props.children[0].props.skill;
}

// print our overall progress in the skill tree
const printTreeProgress = () => {
  const lessonItems = getLessonItems();
  const totalItems = lessonItems.length;
  let completedItems = 0;
  let maxedOutItems = 0;

  let totalLessons = 0;
  let totalFinishedLessons = 0;

  for (let i = 0; i < totalItems; i++) {
    const lessonItemProps = getLessonItemProps(lessonItems[i]);
    if (lessonItemProps.accessible) {
      if (lessonItemProps.finishedLevels > 0) { completedItems++; }
      if (lessonItemProps.finishedLevels === lessonItemProps.levels) { maxedOutItems++; }
    }
    totalLessons += calcMaxLessons(lessonItemProps);
    totalFinishedLessons += lessonItemProps.finishedLessons;
  }

  cPrintColor('-- Progress as of ' + getCurrentTime() + ':', '#000', '#FFFFFF', true);
  cPrintColor('-- Completed ' + completedItems + ' of ' + totalItems + ' skills (' + ((completedItems/totalItems) * 100).toFixed(0) + '%).', '#000', '#38bc54', true);
  cPrintColor('-- Maxed-out ' + maxedOutItems + ' of ' + totalItems + ' skills (' + ((maxedOutItems/totalItems) * 100).toFixed(0) + '%).', '#000', '#ebd532', true);
  // cPrintColor('-- Completed ' + totalFinishedLessons + ' of ' + totalLessons + ' lessons (' + ((totalFinishedLessons/totalLessons) * 100).toFixed(0) + '%).', '#000', '#ebd532', true);
}

// -----------------------------------------------------
// ---------------- GETTERS AND SETTERS ----------------
// -----------------------------------------------------

// set the text in the given 'textAreaElement' to be the supplied 'text'
// note: this was so painful to figure out
const setTextArea = (textAreaElement, text) => {
  FindReact(textAreaElement).props.field.onChange(text);
}

const getDuolingoTextArea = () => {
  return getFirstElementWithClassName('_2MGCg');
}

const setDuolingoTextArea = (text) => {
  setTextArea(getDuolingoTextArea(), text);
}

const getShortTextArea = () => {
  return getDataTestElementsThatMatch('challenge-text-input')[0];
}

const setShortTextArea = (text) => {
  setTextArea(getShortTextArea(), text);
}

const getFirstElementWithClassName = (className) => {
  return document.getElementsByClassName(className)[0];
}

const getDuolingoCheckAnswerButton = () => {
  return getFirstElementWithClassName('cVLwd');
}

const clickCheckAnswerButton = () => {
  getDuolingoCheckAnswerButton().click();
}


// determine if no answer has been selected yet
const noSelectedAnswer = () => {

  switch (getPromptType()) {
    case ('text'):
    case ('text-reverse'):
      return document.getElementsByTagName('textarea')[0].innerHTML === '';
    case ('pictures'):
    case ('characters'):
      return !getFirstElementWithClassName('_2oF6E');
    case ('sound'):
    case ('meaning'):
    case ('missing-word'):
    case ('short-text'):
      return !getFirstElementWithClassName('_2VgPp');
  }
}

const getLanguage = () => {
  return document.head.children[0].innerText.substring(17).match(/^(\w*)/)[1];
}

const getPromptType = () => {

  if (getFirstElementWithClassName('_1J_QC')) {
    return 'checkpoint-prior-knowledge';
  }

  const challengeHeader = getChallengeHeader();

  if (challengeHeader) {

    if (challengeHeader.substring(0, 10) === 'Respond in') {
      return 'checkpoint-free-response';
    }

    if (challengeHeader.match(/^(Write “)/)) { // Write "something" in Language
      return "short-text";
    }

    switch (challengeHeader.substring(0, 13)) {
      case ('What sound do'): // What sound does this make?
        return 'sound';
      case ('Complete the '): // Complete the translation
        return 'complete-translation';
      case ('Select the wo'): // Select the word for "[WORD]"
        return 'pictures';
      case ('Select the co'): // Select the correct characters
        return 'characters';
      case ('Write this in'): // Write this in English (or some other language),
        if (challengeHeader === 'Write this in English') {
          return 'text';
        } else {
          return 'text-reverse';
        }
      case ('Mark the corr'): // Mark the correct meaning
        return 'meaning';
      case ('Match the pai'): // Match the pairs
        return 'pairs';
      case ('Type what you'): // Type what you hear
      case ('Select what y'): // Select what you hear
        return 'listening';
      case ('Click the mic'): // Click the microphone and say:
        return 'speaking';
      case ('Select the mi'): // Select the missing word
        return 'missing-word';
      case ('Fill in the b'): // Select the missing word
        return 'checkpoint-fill-blank';
    }
  }
}

const getSkipButton = () => {
  return getDataTestElementsThatMatch('player-skip')[0];
}

const getSoundAnswers = () => {
  return getDataTestElementsThatMatch('challenge-judge-text');
}

const selectSoundAnswer = (n) => {
  // we need to dummy click a box that isn't the right answer first to fix a bug
  // where the continue button doesn't become clickable after clicking
  const soundAnswers = getSoundAnswers();
  if (soundAnswers.length === 1) {
    soundAnswers[n].click();
  } else if (n > 0) {
    soundAnswers[0].click();
    soundAnswers[n].click();
  } else {
    soundAnswers[1].click();
    soundAnswers[n].click();
  }
}

const getMeaningAnswers = () => {
  return getSoundAnswers(); // the HTML elements have the same dataTest attribute value
}

const selectMeaningAnswer = (n) => {
  selectSoundAnswer(n);
}

const getPicturesAnswers = () => {
  return getFirstElementWithClassName('_2dSPZ').children;
}

const selectPicturesAnswer = (n) => {
  const pictureAnswers = getPicturesAnswers();
  if (n > 0) {
    pictureAnswers[0].children[0].click();
    pictureAnswers[n].children[0].click();
  } else {
    pictureAnswers[1].children[0].click();
    pictureAnswers[n].children[0].click();
  }
}

const getCharactersAnswers = () => {
  return getFirstElementWithClassName('_2dSPZ').children;
}

const selectCharactersAnswer = (n) => {
  const charactersAnswers = getCharactersAnswers();
  if (n > 0) {
    charactersAnswers[0].children[0].click();
    charactersAnswers[n].children[0].click();
  } else {
    charactersAnswers[1].children[0].click();
    charactersAnswers[n].children[0].click();
  }
}

const getPairButtons = () => {
  return getFirstElementWithClassName('_1PGxI').children;
}

const getChallengeHeader = () => {
  const headerElement = getDataTestElementsThatMatch('challenge-header')[0];
  return headerElement ? headerElement.innerText : null;
}

const getAnswerHeader = () => {
  const answerHeader = getFirstElementWithClassName('jJFkx') || getFirstElementWithClassName('_3H0e2');
  return answerHeader.innerText.match(/^([^\n]*)/)[1];
}

const getDataTestElementsThatMatch = (value) => {
  return document.querySelectorAll('[data-test="' + value + '"]');
}

const getSuggestedAnswer = () => {
  const suggestedAnswerElement = getFirstElementWithClassName('_75iiA');
  if (suggestedAnswerElement) { return suggestedAnswerElement.innerText; }
  else { return null; }
}

const getSuggestedAnswers = () => {
  switch (getPromptType()) {
    case ('short-text'):
      return getFirstElementWithClassName('jJFkx').innerText.match(/[:.]\n(.*)/)[1].split(/, /);
    default:
      return getFirstElementWithClassName('jJFkx').innerText.match(/[:.]\n(.*)/)[1].split(/[.?!], /);
  }
}

const isAnswerCorrect = () => {
  return getFirstElementWithClassName('_3H0e2').innerText === "You are correct";
}


const getPrompt = () => {

  const promptType = getPromptType();
  switch (promptType) {
    case ('short-text'):
      return getChallengeHeader().match(/“([^”]*)”/)[1];
    case ('complete-translation'):
      return getFirstElementWithClassName('OGy1T').innerText + ': ' + getFirstElementWithClassName('B04k5').innerText;
    case ('text'):
    case ('text-reverse'):
      return getFirstElementWithClassName('oR3Zt').innerText;
    case ('sound'):
      return getFirstElementWithClassName('XOd-L').innerText;
    case ('pictures'):
      return getChallengeHeader().match(/“([^”]*)”/)[1];
    case ('characters'):
      return getChallengeHeader().match(/“([^”]*)”/)[1];
    case ('meaning'):
      return getFirstElementWithClassName('KRKEd').innerText;
    case ('missing-word'):
      return getDataTestElementsThatMatch('challenge-form-prompt')[0].getAttribute('data-prompt');
    case ('pairs'):
      // there is no prompt for this kind of question
      return null;
  }
}

const getPage = () => {
  if (getDataTestElementsThatMatch("skill-tree")[0]) { return "skill-tree"; };
  if (getPromptType()) { return "lesson"; }
}

const getLessonItems = () => {
  return document.getElementsByClassName('Af4up');
}

const getCheckpoints = () => {
  return document.getElementsByClassName('_1P0tj');
}

const getNextLesson = () => {
  switch (skillTreeCompletionStrategy) {
    case ('bare-minimum'):
      return getNextLessonBareMinimum();
    case ('max-out'):
      return getNextLessonMaxOut();
    case ('bare-minimum-then-max-out'):
      return getNextLessonBareMinimumThenMaxOut();
  }
}

const getNextLessonBareMinimum = () => {
  const checkpointItems = getCheckpoints();
  for (let i = checkpointItems.length - 1; i >= 0; i--) {
    const checkpointItemProps = FindReact(checkpointItems[i]).props;
    // find any unfinished accessible checkpoints
    if (checkpointItemProps.checkpointAccessible && !checkpointItemProps.checkpointFinished) {
      lessonNumber = i+1;
      lessonName = checkpointItemProps.name;
      return checkpointItems[i];
    }
  }
  const lessonItems = getLessonItems();
  for (let i = lessonItems.length - 1; i >= 0; i--) {
    const lessonItemProps = FindReact(lessonItems[i]).props.children.props.children[0].props.skill;
    // find the first lesson that is accessible that we haven't finished
    if (lessonItemProps.accessible && lessonItemProps.finishedLevels === 0) {
      lessonNumber = i+1;
      lessonName = lessonItemProps.name;
      return lessonItems[i];
    }
  }
  return null;
}

const getNextLessonBareMinimumThenMaxOut = () => {
  const checkpointItems = getCheckpoints();
  const lessonItems = getLessonItems();
  for (let i = lessonItems.length - 1; i >= 0; i--) {
    const lessonItemProps = FindReact(lessonItems[i]).props.children.props.children[0].props.skill;
    // find the first lesson that is accessible that we haven't finished
    if (lessonItemProps.accessible && lessonItemProps.finishedLevels !== lessonItemProps.levels) {
      lessonNumber = i+1;
      lessonName = lessonItemProps.name;
      return lessonItems[i];
    }
  }
  for (let i = checkpointItems.length - 1; i >= 0; i--) {
    const checkpointItemProps = FindReact(checkpointItems[i]).props;
    // find any unfinished accessible checkpoints
    if (checkpointItemProps.checkpointAccessible && !checkpointItemProps.checkpointFinished) {
      lessonNumber = i+1;
      lessonName = checkpointItemProps.name;
      return checkpointItems[i];
    }
  }
  return null;
}

const getNextLessonMaxOut = () => {
  const checkpointItems = getCheckpoints();
  const lessonItems = getLessonItems();
  for (let i = 0; i < lessonItems.length; i++) {
    const lessonItemProps = FindReact(lessonItems[i]).props.children.props.children[0].props.skill;
    // find the first lesson that is accessible that we haven't finished
    if (lessonItemProps.accessible && lessonItemProps.finishedLevels !== lessonItemProps.levels) {
      lessonNumber = i+1;
      lessonName = lessonItemProps.name;
      return lessonItems[i];
    }
  }
  for (let i = checkpointItems.length - 1; i >= 0; i--) {
    const checkpointItemProps = FindReact(checkpointItems[i]).props;
    // find any unfinished accessible checkpoints
    if (checkpointItemProps.checkpointAccessible && !checkpointItemProps.checkpointFinished) {
      lessonNumber = i+1;
      lessonName = checkpointItemProps.name;
      return checkpointItems[i];
    }
  }
  return null;
}

const getStartLessonButton = () => {
  return getFirstElementWithClassName('_1N4Qn');
}

const getStartCheckpointButton = () => {
  return getFirstElementWithClassName('Wl6Sg');
}

const startNextLesson = (lessonId) => {

  if (lessonId) { Array.from(getLessonItems()).filter(x => { return getLessonItemProps(x).id === lessonId; })[0].click(); }
  else {
    const prevLessonName = lessonName;
    const prevLessonNumber = lessonNumber;

    // this mutates lessonName to be the name of the next lesson
    getNextLesson().click();

    // if we are on a new lesson now, save the lesson data and move on to the next lesson
    if (saveAndClearLessonDataAfterEachLesson && prevLessonName && (prevLessonName !== lessonName)) {

      // save answer data
      console.save(answerData, getLanguage() + '- Lesson ' + prevLessonNumber + ' - ' + prevLessonName + '.json');

      // reset answer data
      answerData = {};
      initializeLanguageAnswerData();

      // refresh webpage to stop chrome memory from overflowing
      // location.reload();
    }
  }

  if (getStartLessonButton()) { getStartLessonButton().click(); }
  else if (getStartCheckpointButton()) { getStartCheckpointButton().click(); }

}

const setCompleteTranslationTextArea = (answer) => {
  setTextArea(getDataTestElementsThatMatch('challenge-text-input')[0], answer);
}


const answerDuolingoPrompt = (answerSet) => {
  const promptType = getPromptType();

  switch (promptType) {
    case ('text'):
    case ('text-reverse'):
      setDuolingoTextArea(answerSet.values().next().value); // answer with the first value, doesn't matter since it's a text question
      break;
    case ('complete-translation'):
      setCompleteTranslationTextArea(answerSet.values().next().value);
      break;
    case ('short-text'):
      const meaningAnswers = getMeaningAnswers();
      if (meaningAnswers.length > 0) {
        answerSet.forEach((recordedAnswer) => {
          let i = 0;
          meaningAnswers.forEach((meaningAnswer) => {
            let matchedAnswer = recordedAnswer.match(new RegExp('^' + meaningAnswer.innerText + '(.*)'));
            if (matchedAnswer && getShortTextArea().value === '') {
              cPrint(matchedAnswer);
              selectMeaningAnswer(i);
              setShortTextArea(matchedAnswer[1]);
              return;
            }
          i++;
          });
        });
      } else {
        setShortTextArea(answerSet.values().next().value);
      }
      break;
    case ('sound'):
      const soundAnswers = getSoundAnswers();
      answerSet.forEach((text) => {
        for (let i = 0; i < soundAnswers.length; i++) {
          if (soundAnswers[i].innerText === text) {
            selectSoundAnswer(i);
          }
        }
      });
      break;
    case ('pictures'):
    case ('characters'):
      const charactersAnswers = getCharactersAnswers();
      answerSet.forEach((text) => {
        for (let i = 0; i < charactersAnswers.length; i++) {
          if (charactersAnswers[i].innerText.match(/(.*)\n/)[1] === text) {
            selectCharactersAnswer(i);
          }
        }
      });
      break;
    case ('meaning'):
      const meaningAnwers = getMeaningAnswers();
      answerSet.forEach((text) => {
        for (let i = 0; i < meaningAnwers.length; i++) {
          if (meaningAnwers[i].innerText === text) {
            selectMeaningAnswer(i);
          }
        }
      });
      break;
    case ('missing-word'):
      const missingWordAnswers = getMeaningAnswers();
      answerSet.forEach((text) => {
        for (let i = 0; i < missingWordAnswers.length; i++) {
          if (missingWordAnswers[i].innerText === text) {
            selectMeaningAnswer(i);
          }
        }
      });
      break;
  }
  clickCheckAnswerButton();
}

const fakeAnswerPrompt = () => {
  const promptType = getPromptType();
  switch (promptType) {
    case ('short-text'):
      if (getMeaningAnswers().length > 0) { selectMeaningAnswer(0); } // sometimes you must select an answer AND write, how 'bout that?
      setShortTextArea('I don\'t know the answer :(');
      break;
    case ('complete-translation'):
      setCompleteTranslationTextArea(':(');
      break;
    case ('text'):
    case ('text-reverse'):
      setDuolingoTextArea('I don\'t know the answer :(');
      break;
    case ('sound'):
      // sometimes with these prompts selecting the answer doesn't unblock the continue button
      selectSoundAnswer(0);
      break;
    case ('pictures'):
      selectPicturesAnswer(0);
      break;
    case ('characters'):
      selectCharactersAnswer(0);
      break;
    case ('meaning'):
      selectMeaningAnswer(0);
      break;
    case ('missing-word'):
      selectMeaningAnswer(0);
      break;
    case ('pairs'): // pairs has its own implementation for answering
      break;
  }
  clickCheckAnswerButton();
}

// todo use saved pairs when iterating through them (should we even do this? who cares about the pairs?)
const solvePairs = () => {

  const pairButtons = getPairButtons();

  // iterate through all pairButtons
  // if we already know what the match is supposed to be,
  // click this one and then find that one and click it
  // if we don't what what it is then we need to try all pairs until we find it
  for (let i = 0; i < pairButtons.length; i++) {
    const pairButton = pairButtons[i];
    if (!pairButton.disabled) {

      for (let k = i+1; (k < pairButtons.length) && !pairButton.disabled; k++) {
        const matchingPairButton = pairButtons[k];
        cPrint('trying to match \'' + pairButton.innerText + '\' with \''+ matchingPairButton.innerText + '\'');
        if (!matchingPairButton.disabled) {
          pairButton.click();
          matchingPairButton.click();
          if (pairButton.disabled) { // if we clicked on the correct match, both buttons become disabled
            answerData[getLanguage()][getPromptType()][pairButton.innerText] = matchingPairButton.innerText;
            answerData[getLanguage()][getPromptType()][matchingPairButton.innerText] = pairButton.innerText;
          }
        }
      }
    }
  }
}

const isCheckAnswerButtonDisabled = () => {
  return getDuolingoCheckAnswerButton().getAttribute('disabled') == '';
}

const keyboardDisabled = () => {
    const changeInputTypeButton = getDataTestElementsThatMatch('player-toggle-keyboard')[0];
  return changeInputTypeButton ? changeInputTypeButton.innerText === 'USE KEYBOARD' : false;
}

const solve = () => {
  const promptType = getPromptType();
  // we just want to disabled the listening/speaking questions
  if (promptType === 'listening' || promptType === 'speaking') {
    getSkipButton().click();
  } else if (promptType === 'checkpoint-prior-knowledge') {
    // pick "0" as the amount knowledge you had before starting learning
    getFirstElementWithClassName('_1J_QC').click();
    clickCheckAnswerButton();
  } else if (promptType === 'checkpoint-fill-blank') {
    clickCheckAnswerButton();
    clickCheckAnswerButton();
    getMeaningAnswers()[0].click();
    clickCheckAnswerButton();
  } else if (promptType === 'checkpoint-free-response') {
    document.getElementsByClassName('_1tSEs')[1].click();
    clickCheckAnswerButton();
  } else if (promptType === 'pairs') {
    solvePairs();
  } else {
    const prompt = getPrompt();
    const answer = answerData[getLanguage()][promptType][prompt];
    if (answer) {
      answerDuolingoPrompt(answer);
      if (noSelectedAnswer()) {
        fakeAnswerPrompt();
        fakedLastAnswer = true;
      } else if (isCheckAnswerButtonDisabled()) {
        // if we have selected an answer but the check answer button isn't available then something is wrong
        const skipButton = getSkipButton();
        if (skipButton) { skipButton.click(); }
      }
    } else {
      fakeAnswerPrompt();
      fakedLastAnswer = true;
    }
  }
}

const getCurrentAnswer = () => {
  return answerData[getLanguage()][getPromptType()][getPrompt()];
}

const updateAnswers = () => {
  const suggestedAnswer = getSuggestedAnswer();
  const prompt = getPrompt();
  const promptType = getPromptType();
  if (getAnswerHeader() === "Correct solution:" && promptType === 'complete-translation') {
    const translationAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
    answerData[getLanguage()][promptType][prompt] = translationAnswerSet.add(getFirstElementWithClassName('_3Fow7').innerText);
  }
  else if (suggestedAnswer) {
    if (getAnswerHeader() === "Correct solutions:") {
      const suggestedAnswers = getSuggestedAnswers();
      let textAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
      textAnswerSet = textAnswerSet.add(suggestedAnswers[0]);
      textAnswerSet = textAnswerSet.add(suggestedAnswers[1]);
      answerData[getLanguage()][promptType][prompt] = textAnswerSet;
      cPrint(prompt + ' --> ' + getSuggestedAnswers()[0]);
      cPrint(prompt + ' --> ' + getSuggestedAnswers()[1]);
    } else {
      let textAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
      answerData[getLanguage()][promptType][prompt] = textAnswerSet.add(suggestedAnswer);
      cPrint(prompt + ' --> ' + suggestedAnswer);
    }
  } else if (isAnswerCorrect()) {
    switch (getPromptType()) {
      case ('sound'):
        const soundAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
        answerData[getLanguage()][promptType][prompt] = soundAnswerSet.add(getSoundAnswers()[0].innerText);
        break;
      case ('pictures'):
        const picturesAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
        answerData[getLanguage()][promptType][prompt] = picturesAnswerSet.add(getPicturesAnswers()[0].innerText.match(/\n(.*)/)[1]);
        break;
      case ('characters'):
        const charactersAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
        answerData[getLanguage()][promptType][prompt] = charactersAnswerSet.add(getCharactersAnswers()[0].innerText.match(/(.*)\n/)[1]);
        break;
      case ('meaning'):
        const meaningAnswerSet = answerData[getLanguage()][promptType][prompt] || new Set([]);
        answerData[getLanguage()][promptType][prompt] = meaningAnswerSet.add(getMeaningAnswers()[0].innerText);
        break;
    }
  }
}

// skip any "create a profile" dialogs
const skipCreateProfileDialog = () => {

  // skip the "oh you need to create a profile thing" at the end of the lesson
  if (getFirstElementWithClassName('_38GCi')) {
    cPrint('skipping "create a new profile" dialog');
    getFirstElementWithClassName('_20MEq').click();
  }

  // you need to actually create an account to keep using duolingo
  // if you get the "create and account" dialog in the skill tree
  if (getFirstElementWithClassName('_3KhEc')) {
    // getFirstElementWithClassName('_3NE8v').click(); -- this tries to skip the button lol
    stop();
    console.debug('ERROR: YOU MUST MAKE A DUOLINGO ACCOUNT TO CONTINUE!')
  }
}

const skillMaxedOut = (skillId) => {
  return getLessonItemProps(Array.from(getLessonItems()).filter(x => { return getLessonItemProps(x).id === skillId; })[0]).finishedLevels === 5;
}

const launchTabsForFinishedLessons = () => {
  let foundTab = false;
  Array.from(getLessonItems()).filter((skill) => {
    const skillProps = getLessonItemProps(skill);
    return skillProps.finishedLevels > 0 && !skillMaxedOut(skillProps.id) && !createdTabsForTheseSkills[skillProps.id];
  }).map((skill) => {
    openNewTabForSkill(getLessonItemProps(skill).id);
    createdTabsForTheseSkills[getLessonItemProps(skill).id] = true;
  });
}

// todo give random answers for the checkpoint questions (you pass them anyways)
const navigate = () => {

  // make sure we have our data objects initialized
  initializeLanguageAnswerData();

  // skip any "create a profile" dialogs
  skipCreateProfileDialog();

  switch (getPage()) {
    case ('skill-tree'):
      printTreeProgress();
      const skillToComplete = getSkillToComplete();
      if (skillToComplete) {
        if (!skillMaxedOut(skillToComplete)) {
          startNextLesson(skillToComplete);
        } else {
          closeTab();
        }
      }
      else {
        launchTabsForFinishedLessons();
        if (duolingoAIEnabled) { startNextLesson(); }
      }
      break;
    case ('lesson'):
      if (keyboardDisabled()) {
        getDataTestElementsThatMatch('player-toggle-keyboard')[0].click();
      }
      if (getDuolingoCheckAnswerButton().disabled || getDuolingoCheckAnswerButton().innerText === 'NEXT') {
        solve();
      } else if (getDuolingoCheckAnswerButton().innerText === 'CHECK') {
        clickCheckAnswerButton(); // check your answer
      } else if (getDuolingoCheckAnswerButton().innerText === 'CONTINUE') {
        if (fakedLastAnswer) { updateAnswers(); }
        fakedLastAnswer = false;
        clickCheckAnswerButton(); // continue to next question
      }
      break;
    default:
      // if we don't have any specific plans, and there is a button to continue, we should click it
      if (getDuolingoCheckAnswerButton()) { clickCheckAnswerButton(); }
      break;
  }
}

const start = () => {
  duolingoAIEnabled = true;
}

const enableDebug = () => {
  debugLogEnabled = true;
}

const disableDebug = () => {
  debugLogEnabled = false;
}

const startWith = (json) => {
  answerData = JSON.parse(json);
  start();
}

const stop = () => {
  duolingoAIEnabled = false;
}

let interval = undefined;

// set chrome to trigger the navigation function every 'stepEvery' milliseconds
const enableIntervalTrigger = () => {
  interval = setInterval(() => {
    if (duolingoAIEnabled) {
      navigate();
    }
  }, stepEvery);
}

// modify the interval at which we trigger our code
const setSpeed = (n) => {
  clearInterval(interval);
  stepEvery = n;
  enableIntervalTrigger();
}

// enable our code trigger
setTimeout(enableIntervalTrigger, 1500);
