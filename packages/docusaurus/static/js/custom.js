/* global document */

document.addEventListener(`scroll`, () => {
  const navbar = document.querySelector(`.navbar.navbar--fixed-top`);
  if (!navbar)
    return;

  const navbarPosition = navbar.getBoundingClientRect().top;
  const navbarIsFixed = navbarPosition <= 0;

  navbar.classList.toggle(`navbar--is-fixed`, navbarIsFixed);
});
