import {IMPORTED_PATTERNS} from "../sources/LegacyMigrationResolver";

describe(`LegacyMigrationResolver`, () => {
  const tests: Array<{version: string, resolved: string, expected: string}> = [
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
