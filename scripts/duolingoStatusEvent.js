// As Duolingo page doesn't refresh and only update its content, this code watchs all the posibles changes.
// When a change is detected, it dispatch an event.

let prevCourse = null;
setInterval(function () {
    const pageData = window.getReactElement(document.querySelector("._3yE3H"))?.return?.return?.memoizedProps;
    const course = pageData?.course.id;

    if (prevCourse !== course) { window.dispatchEvent(new CustomEvent("DuolingoRefresh", { detail: { course, path: document.location.pathname } })) };
    prevCourse = course;
}, 500);
