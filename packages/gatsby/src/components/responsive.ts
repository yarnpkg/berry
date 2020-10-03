export const ifMobile = () => `@media (max-width: 760px)`;
export const ifDesktop = () => `@media (min-width: 761px)`;
export const ifShortViewport = () => `@media (max-height: 600px)`;
export const ifTallViewport = () => `@media (min-height: 601px)`;

export type MediaFn = () => string;

export function getMediaQuery(mediaFn: MediaFn) {
  if (typeof window === `undefined`)
    return null;

  const query = /@media (.+)/.exec(mediaFn())?.[1];
  if (!query)
    throw new Error(`Assertion failed: Expected a valid media query.`);

  return query;
}

