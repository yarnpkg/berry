export const ifMobile = () => `@media (max-width: 760px)`;
export const ifDesktop = () => `@media (min-width: 761px)`;
export const ifTallViewport = () => `@media (min-height: 600px)`;

export type MediaFn = () => string;

export function matchMedia(mediaFn: MediaFn) {
  const query = /@media (.+)/.exec(mediaFn())?.[1];
  if (!query)
    throw new Error(`Assertion failed: Expected a valid media query.`);

  return window.matchMedia(query);
}

export function matchesMedia(mediaFn: MediaFn) {
  return matchMedia(mediaFn).matches;
}
