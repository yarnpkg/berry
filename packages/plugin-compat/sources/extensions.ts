// To extend this list, please open a PR on the relevant repository that adds
// the same fields as you add here and prefix your changes with the relevant
// PR url.

const optionalPeerDep = {
  optional: true,
};

export const packageExtensions: Array<[string, any]> = [
  // https://github.com/SamVerschueren/stream-to-observable/pull/5
  [`@samverschueren/stream-to-observable@*`, {
    peerDependenciesMeta: {
      [`rxjs`]: optionalPeerDep,
      [`zenObservable`]: optionalPeerDep,
    },
  }],
  // https://github.com/sindresorhus/any-observable/pull/25
  [`any-observable@<0.5.1`, {
    peerDependenciesMeta: {
      [`rxjs`]: optionalPeerDep,
      [`zenObservable`]: optionalPeerDep,
    },
  }],
  // https://github.com/keymetrics/pm2-io-agent/pull/125
  [`@pm2/agent@<1.0.4`, {
    dependencies: {
      [`debug`]: `*`,
    },
  }],
  // https://github.com/visionmedia/debug/pull/727
  [`debug@*`, {
    peerDependenciesMeta: {
      [`supports-color`]: optionalPeerDep,
    },
  }],
  // https://github.com/sindresorhus/got/pull/1125
  [`got@<11`, {
    dependencies: {
      [`@types/responselike`]: `^1.0.0`,
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/szmarczak/cacheable-lookup/pull/12
  [`cacheable-lookup@<4.1.2`, {
    dependencies: {
      [`@types/keyv`]: `^3.1.1`,
    },
  }],
  // https://github.com/prisma-labs/http-link-dataloader/pull/22
  [`http-link-dataloader@*`, {
    peerDependencies: {
      [`graphql`]: `^0.13.1 || ^14.0.0`,
    },
  }],
  // https://github.com/theia-ide/typescript-language-server/issues/144
  [`typescript-language-server@*`, {
    dependencies: {
      [`vscode-jsonrpc`]: `^5.0.1`,
      [`vscode-languageserver-protocol`]: `^3.15.0`,
    },
  }],
  // https://github.com/gucong3000/postcss-syntax/pull/46
  [`postcss-syntax@*`, {
    peerDependenciesMeta: {
      [`postcss-html`]: optionalPeerDep,
      [`postcss-jsx`]: optionalPeerDep,
      [`postcss-less`]: optionalPeerDep,
      [`postcss-markdown`]: optionalPeerDep,
      [`postcss-scss`]: optionalPeerDep,
    },
  }],
  // https://github.com/cssinjs/jss/pull/1315
  [`jss-plugin-rule-value-function@<=10.1.1`, {
    dependencies: {
      [`tiny-warning`]: `^1.0.2`,
    },
  }],
];
