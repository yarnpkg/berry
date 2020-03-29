// To extend this list, please open a PR on the relevant repository that adds
// the same fields as you add here and prefix your changes with the relevant
// PR url.

export const packageExtensions: Array<[string, any]> = [
  // https://github.com/SamVerschueren/stream-to-observable/pull/5
  [`@samverschueren/stream-to-observable@*`, {
    peerDependenciesMeta: {
      [`rxjs`]: {
        optional: true,
      },
      [`zenObservable`]: {
        optional: true,
      },
    },
  }],
  // https://github.com/sindresorhus/any-observable/pull/25
  [`any-observable@*`, {
    peerDependenciesMeta: {
      [`rxjs`]: {
        optional: true,
      },
      [`zenObservable`]: {
        optional: true,
      },
    },
  }],
  // https://github.com/keymetrics/pm2-io-agent/pull/125
  [`@pm2/agent@*`, {
    dependencies: {
      [`debug`]: `*`,
    },
  }],
  // https://github.com/visionmedia/debug/pull/727
  [`debug@*`, {
    peerDependenciesMeta: {
      [`supports-color`]: {
        optional: true,
      },
    },
  }],
  // https://github.com/sindresorhus/got/pull/1125
  [`got@*`, {
    dependencies: {
      [`@types/responselike`]: `^1.0.0`,
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/szmarczak/cacheable-lookup/pull/12
  [`cacheable-lookup@*`, {
    dependencies: {
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/theia-ide/typescript-language-server/issues/144
  [`typescript-language-server@*`, {
    dependencies: {
      [`vscode-jsonrpc`]: `^5.0.1`,
      [`vscode-languageserver-protocol`]: `^3.15.0`,
    },
  }],
];
