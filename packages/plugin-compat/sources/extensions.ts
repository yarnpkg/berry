// To extend this list, please open a PR on the relevant repository that adds
// the same fields as you add here and prefix your changes with the relevant
// PR url.

export const packageExtensions: Array<[string, any]> = [
  // https://github.com/SamVerschueren/stream-to-observable/pull/5
  [`@samverschueren/stream-to-observable@*`, {
    peerDependenciesMeta: {
      [`rxjs`]: `*`,
      [`zenObservable`]: `*`,
    },
  }],
  // https://github.com/sindresorhus/any-observable/pull/25
  [`any-observable@*`, {
    peerDependenciesMeta: {
      [`rxjs`]: `*`,
      [`zenObservable`]: `*`,
    },
  }],
  // https://github.com/keymetrics/pm2-io-agent/pull/125
  [`@pm2/agent@*`, {
    dependencies: {
      [`debug`]: `*`,
    },
  }],
];
