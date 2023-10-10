import * as gitUtils from '../sources/gitUtils';

const VALID_PATTERNS = [
  [`GitHubOrg/foo-bar.js`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `head`,
      request: `HEAD`,
    },
  }],
  [`GitHubOrg/foo2bar.js`, {
    standard: `https://github.com/GitHubOrg/foo2bar.js.git`,
    git: `https://github.com/GitHubOrg/foo2bar.js.git`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo2bar.js.git`,
    treeish: {
      protocol: `head`,
      request: `HEAD`,
    },
  }],
  [`GitHubOrg/foo-bar.js#hash`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#hash`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#hash`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: null,
      request: `hash`,
    },
  }],
  [`GitHubOrg/foo-bar.js#commit:hash`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#commit:hash`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#commit:hash`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `commit`,
      request: `hash`,
    },
  }],
  [`GitHubOrg/foo-bar.js#commit=hash`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#commit=hash`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#commit=hash`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `commit`,
      request: `hash`,
    },
  }],
  [`GitHubOrg/foo-bar.js#commit=hash&workspace=foo`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#commit=hash&workspace=foo`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#commit=hash&workspace=foo`,
  }, {
    extra: {
      workspace: `foo`,
    },
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `commit`,
      request: `hash`,
    },
  }],
  [`GitHubOrg/foo-bar.js#tag=hello`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#tag=hello`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#tag=hello`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `tag`,
      request: `hello`,
    },
  }],
  [`GitHubOrg/foo-bar.js#workspace=foo`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#workspace=foo`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#workspace=foo`,
  }, {
    extra: {
      workspace: `foo`,
    },
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `head`,
      request: `HEAD`,
    },
  }],
  [`github:GitHubOrg/foo-bar.js`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: `head`,
      request: `HEAD`,
    },
  }],
  [`github:GitHubOrg/foo-bar.js#hash`, {
    standard: `https://github.com/GitHubOrg/foo-bar.js.git#hash`,
    git: `https://github.com/GitHubOrg/foo-bar.js.git#hash`,
  }, {
    extra: {},
    repo: `https://github.com/GitHubOrg/foo-bar.js.git`,
    treeish: {
      protocol: null,
      request: `hash`,
    },
  }],
  [`https://github.com/yarnpkg/util-deprecate.git#v1.0.0`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#v1.0.0`,
    git: `https://github.com/yarnpkg/util-deprecate.git#v1.0.0`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.0`,
    },
  }],
  [`https://github.com/yarnpkg/util-deprecate.git#semver:v1.0.0`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#semver:v1.0.0`,
    git: `https://github.com/yarnpkg/util-deprecate.git#semver:v1.0.0`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: `semver`,
      request: `v1.0.0`,
    },
  }],
  [`https://github.com/yarnpkg/util-deprecate.git#master`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#master`,
    git: `https://github.com/yarnpkg/util-deprecate.git#master`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `master`,
    },
  }],
  [`https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
    git: `https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `b3562c2798507869edb767da869cd7b85487726d`,
    },
  }],
  [`https://github.com/yarnpkg/util-deprecate/tarball/b3562c2798507869edb767da869cd7b85487726d`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
    git: `https://github.com/yarnpkg/util-deprecate.git#b3562c2798507869edb767da869cd7b85487726d`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `b3562c2798507869edb767da869cd7b85487726d`,
    },
  }],
  [`git://github.com/yarnpkg/util-deprecate.git#v1.0.1`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
    git: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.1`,
    },
  }],
  [`git+ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`, {
    standard: `git+ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`,
    git: `ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`,
  }, {
    extra: {},
    repo: `git+ssh://git@github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.1`,
    },
  }],
  [`ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`, {
    standard: `ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`,
    git: `ssh://git@github.com/yarnpkg/util-deprecate.git#v1.0.1`,
  }, {
    extra: {},
    repo: `ssh://git@github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.1`,
    },
  }],
  [`git+ssh://git@github.com:yarnpkg/berry.git#v2.1.1`, {
    standard: `git+ssh://git@github.com:yarnpkg/berry.git#v2.1.1`,
    git: `ssh://git@github.com/yarnpkg/berry.git#v2.1.1`,
  }, {
    extra: {},
    repo: `git+ssh://git@github.com:yarnpkg/berry.git`,
    treeish: {
      protocol: null,
      request: `v2.1.1`,
    },
  }],
  [`ssh://git@github.com:yarnpkg/berry.git#v2.1.1`, {
    standard: `ssh://git@github.com:yarnpkg/berry.git#v2.1.1`,
    git: `ssh://git@github.com/yarnpkg/berry.git#v2.1.1`,
  }, {
    extra: {},
    repo: `ssh://git@github.com:yarnpkg/berry.git`,
    treeish: {
      protocol: null,
      request: `v2.1.1`,
    },
  }],
  [`git+https://github.com/yarnpkg/util-deprecate#v1.0.1`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
    git: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.1`,
    },
  }],
  [`git+https://github.com/yarnpkg/util-deprecate.git#v1.0.1`, {
    standard: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
    git: `https://github.com/yarnpkg/util-deprecate.git#v1.0.1`,
  }, {
    extra: {},
    repo: `https://github.com/yarnpkg/util-deprecate.git`,
    treeish: {
      protocol: null,
      request: `v1.0.1`,
    },
  }],
] as const;

const INVALID_PATTERNS = [
  `./.`,
  `../..`,
];

describe(`gitUtils`, () => {
  for (const [pattern] of VALID_PATTERNS) {
    it(`should detect ${pattern} as a valid Git url`, () => {
      expect(gitUtils.isGitUrl(pattern)).toEqual(true);
    });
  }

  for (const pattern of INVALID_PATTERNS) {
    it(`shouldn't detect ${pattern} as a valid Git url`, () => {
      expect(gitUtils.isGitUrl(pattern)).toEqual(false);
    });
  }

  for (const [pattern, normalized] of VALID_PATTERNS) {
    it(`should properly normalize ${pattern} ({ git: false })`, () => {
      expect(gitUtils.normalizeRepoUrl(pattern)).toEqual(normalized.standard);
    });
    it(`should properly normalize ${pattern} ({ git: true })`, () => {
      expect(gitUtils.normalizeRepoUrl(pattern, {git: true})).toEqual(normalized.git);
    });
  }

  for (const [pattern, , split] of VALID_PATTERNS) {
    it(`should properly split ${pattern}`, () => {
      expect(gitUtils.splitRepoUrl(pattern)).toEqual(split);
    });
  }
});
