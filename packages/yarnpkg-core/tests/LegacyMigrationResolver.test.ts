import {IMPORTED_PATTERNS} from "../sources/LegacyMigrationResolver";

describe(`LegacyMigrationResolver`, () => {
  const tests: Array<{version: string, resolved: string, expected: string}> = [
    // http registries
    {
      version: `4.17.21`,
      resolved: `http://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz`,
      expected: `npm:4.17.21`,
    },
    // https://github.com/yarnpkg/berry/pull/2696
    {
      version: `1.0.0`,
      resolved: `https://foo.bar/@types%2fno-deps/-/no-deps-1.0.0.tgz`,
      expected: `npm:1.0.0`,
    },
    // https://github.com/yarnpkg/berry/issues/2354
    {
      version: `1.0.0`,
      resolved: `https://company.jfrog.io/company/api/npm/registry-name/@scope/package-name/-/@scope/package-name-1.0.0.tgz#eeeec1e4e8850bed0468f938292b06cda793bf34`,
      expected: `npm:1.0.0::__archiveUrl=https%3A%2F%2Fcompany.jfrog.io%2Fcompany%2Fapi%2Fnpm%2Fregistry-name%2F%40scope%2Fpackage-name%2F-%2F%40scope%2Fpackage-name-1.0.0.tgz%23`,
    },
    // https://github.com/yarnpkg/berry/issues/902#issuecomment-732360991
    {
      version: `0.1.9`,
      resolved: `https://npm.fontawesome.com/@fortawesome/vue-fontawesome/-/0.1.10/vue-fontawesome-0.1.10.tgz#eeeec1e4e8850bed0468f938292b06cda793bf34`,
      expected: `npm:0.1.9`,
    },
    // Taobao registry
    {
      version: `12.0.5`,
      resolved: `https://registry.npm.taobao.org/yargs/download/yargs-12.0.5.tgz?cache=0&other_urls=https%3A%2F%2Fregistry.npm.taobao.org%2Fyargs%2Fdownload%2Fyargs-12.0.5.tgz#05f5997b609647b64f66b81e3b4b10a368e7ad13`,
      expected: `npm:12.0.5`,
    },
    // https://github.com/yarnpkg/berry/issues/902#issuecomment-588579962
    {
      version: `0.0.0`,
      resolved: `git://github.com/nash-io/react-input-range#7895c98aaadb0f115557efd17330e10da8b785c7`,
      expected: `git://github.com/nash-io/react-input-range#commit=7895c98aaadb0f115557efd17330e10da8b785c7`,
    },
    // https://github.com/yarnpkg/berry/issues/902#issuecomment-703041768
    {
      version: `3.1.1`,
      resolved: `https://nexusrepomgr.$CORPORATION.com/repository/npm-proxy/yn/-/yn-3.1.1.tgz#1e87401a09d767c1d5eab26a6e4c185182d2eb50`,
      expected: `npm:3.1.1`,
    },
    // https://github.com/yarnpkg/berry/pull/1920
    {
      version: `0.3.2`,
      resolved: `https://npm.pkg.github.com/download/@datadog/build-plugin/0.3.2/92bb5d31f0463b9c175da48fcdbc5a6743ba65d9b337383c4a2deae2ad7dd531`,
      expected: `npm:0.3.2`,
    },
    // https://discord.com/channels/226791405589233664/654372321225605128/869109290286325770
    {
      version: `1.0.0`,
      resolved: `https://npm.pkg.github.com/download/@foo/bar/1.0.0/45936cf20c2c6a884858e18ee56d7c8db9ca080e47929e1691bef048ee2802cf#1c16d31238ac5f93e311b44b0eced1f8251d44d4`,
      expected: `npm:1.0.0`,
    },
  ];

  for (const {expected, resolved, version} of tests) {
    it(`should match ${resolved} to ${expected}`, () => {
      let reference;
      for (const [pattern, matcher] of IMPORTED_PATTERNS) {
        const match = resolved.match(pattern);

        if (match) {
          reference = matcher(version, ...match);
          break;
        }
      }

      expect(reference).toEqual(expected);
    });
  }
});
