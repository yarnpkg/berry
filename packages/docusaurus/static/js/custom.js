/* global window, document, IntersectionObserver */

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

(function(h, o, u, n, d) {
  h = h[d] = h[d] || {q: [], onReady(c) {
    h.q.push(c);
  }};

  d = o.createElement(u);
  d.async = 1;
  d.src = n;

  n = o.getElementsByTagName(u)[0];
  n.parentNode.insertBefore(d, n);
})(window, document, `script`, `https://www.datadoghq-browser-agent.com/eu1/v4/datadog-rum.js`, `DD_RUM`);

window.DD_RUM.onReady(() => {
  if (window.location.hostname === `localhost`)
    return;

  window.DD_RUM.init({
    clientToken: `pub1a6a8297806619f54ea9bcd09db65a1d`,
    applicationId: `b171f67b-280f-4f2e-ab56-f0970eb39809`,
    site: `datadoghq.eu`,
    service: `yarn-website`,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: `mask-user-input`,
  });

  window.DD_RUM.startSessionReplayRecording();
});
