declare const YARN_VERSION: string | null;

export const YarnVersion = typeof YARN_VERSION !== `undefined`
  ? YARN_VERSION
  : null;
