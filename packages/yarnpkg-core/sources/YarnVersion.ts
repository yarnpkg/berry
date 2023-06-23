declare const YARN_VERSION: string | null;

export const YarnVersion = typeof YARN_VERSION !== `undefined`
  ? process.env.YARN_IS_TEST_ENV ? `0.0.0` : YARN_VERSION
  : null;
