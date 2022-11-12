/* global document, IntersectionObserver */

const observer = new IntersectionObserver(
  ([e]) => e.target.classList.toggle(`navbar--is-fixed`, e.intersectionRatio < 1),
  {threshold: [1]},
);

document.addEventListener(`scroll`, () => {
  const navbar = document.querySelector(`.navbar.navbar--fixed-top`);
  if (!navbar)
    return;

  observer.observe(navbar);
});
