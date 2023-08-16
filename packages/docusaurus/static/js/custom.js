/* global window, document, IntersectionObserver */

const navbarCheck = document.createElement(`div`);
navbarCheck.style.cssText = `position: absolute; top: 0; left: 0; right: 0; z-index: 9999; margin-top: var(--index-navbar-margin-top); height: var(--ifm-navbar-height); pointer-events: none;`;

const intersectionObserver = new IntersectionObserver(
  ([e]) => document.documentElement.classList.toggle(`navbar--is-fixed`, e.intersectionRatio < 1),
  {threshold: [1]},
);

document.addEventListener(`scroll`, () => {
  if (!navbarCheck.parentNode)
    document.body.appendChild(navbarCheck);
  intersectionObserver.observe(navbarCheck);
});

// ---

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
