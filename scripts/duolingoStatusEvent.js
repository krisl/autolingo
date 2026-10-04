// As Duolingo page doesn't refresh and only update its content, this code watchs all the posibles changes.
// When a change is detected, it dispatch an event.

let prevCourse = null;
let prevPlayerStatus = undefined;
const possiblePageLikeTerms = ["lesson", "practice", "alphabets", "placement"];
function pollLessonStatus() {
    const pageData = window.getReactElement(queryFirst(SELECTORS.lessonRoot, window.document, true))?.return?.return?.memoizedProps;
    const course = pageData?.course?.id;

    if (prevCourse !== course) {
        prevCourse = course;
        if (possiblePageLikeTerms.some((t) => document.location.pathname.includes(t))) {
            prevPlayerStatus = undefined;
        }
    }

    let playerStatus = pageData?.player?.status;
    if (prevPlayerStatus === playerStatus) return;

    prevPlayerStatus = playerStatus;
    if (playerStatus) {
        console.log(new Date().toISOString(), "Dispatching event", pageData)
        window.dispatchEvent(new CustomEvent("LessonStatusChanged", { detail: pageData }));
    }
}
setInterval(pollLessonStatus, 500);
