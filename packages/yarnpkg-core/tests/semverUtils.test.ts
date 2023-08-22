/* eslint-disable no-restricted-properties */
import semver           from 'semver';

import * as semverUtils from '../sources/semverUtils';

type Specs = Array<[string, string, boolean]>;

const SPECS: Specs = [
  // Those three are different from includePrerelease
  [`^5.0.0`, `5.0.0-beta.13`, true],
  [`^1.0.0`, `1.0.0-rc1`, true],
  [`2.x`, `3.0.0-pre.0`, false],

  // From the semver test-suite
  ...[
    [`2.x`, `2.0.0-pre.0`, true],
    [`2.x`, `2.1.0-pre.0`, true],
    [`1.1.x`, `1.1.0-a`, true],
    [`1.1.x`, `1.1.1-a`, true],
    [`*`, `1.0.0-rc1`, true],
    [`^1.0.0-0`, `1.0.1-rc1`, true],

    // https://github.com/yarnpkg/berry/pull/1748#discussion_r475268862
    // [`^1.0.0-rc2`, `1.0.1-rc1`, true],

    [`^1.0.0`, `1.0.1-rc1`, true],
    [`^1.0.0`, `1.1.0-rc1`, true],
    [`1 - 2`, `2.0.0-pre`, true],
    [`1 - 2`, `1.0.0-pre`, true],
    [`1.0 - 2`, `1.0.0-pre`, true],

    [`=0.7.x`, `0.7.0-asdf`, true],
    [`>=0.7.x`, `0.7.0-asdf`, true],
    [`<=0.7.x`, `0.7.0-asdf`, true],

    [`>=1.0.0 <=1.1.0`, `1.1.0-pre`, true],
  ] as Specs,

  [`^1.0.0`, `2.0.0-rc1`, false],
  [`^1.2.3-rc2`, `2.0.0`, false],

  // These are important: false positives with fixed ranges
  [`1.0.0-alpha.37`, `1.0.0-alpha.39`, false],
  [`1.0.0-rc2`, `1.0.0-rc4`, false],
  [`1.0.0-rc4`, `1.0.0-rc2`, false],
  [`1.0.0-beta.1`, `1.0.0-beta.2`, false],

  // These don't match with our patch but do without it
  [`<=5.0.0-beta.0`, `5.0.0-alpha.7`, true],
];

describe(`semverUtils`, () => {
  describe(`satisfiesWithPrereleases`, () => {
    let differentResults = 0;

    describe(`specs`, () => {
      for (const [range, version, satisfied] of SPECS) {
        it(`${satisfied ? `should` : `shouldn't`} satisfy ${range} with ${version}`, () => {
          const semverUtilsResult = semverUtils.satisfiesWithPrereleases(version, range);
          const semverResult = semver.satisfies(version, range, {includePrerelease: true});

          expect(semverUtilsResult).toEqual(satisfied);

          if (semverResult !== semverUtilsResult) {
            ++differentResults;
          }
        });
      }
    });

    it(`should not be obsolete with semver.satisfies(version, range, {includePrerelease: true})`, () => {
      expect(differentResults).toBeGreaterThan(0);
    });
  });

  describe(`clean`, () => {
    const TEST_CASES = [
      [`1.0.0`, `1.0.0`],
      [`1.0.0+123`, `1.0.0+123`],
      [` \t\r\nv=1.0.0+123 \t\r\n`, `1.0.0+123`],
      [`1.0.0!`, null],
    ] as const;

    for (const [input, output] of TEST_CASES) {
      it(`${output ? `should` : `shouldn't`} clean ${JSON.stringify(input)}${
        output ? ` to ${JSON.stringify(output)}` : ``
      }`, () => {
        expect(semverUtils.clean(input)).toEqual(output);
      });
    }
  });

  describe(`simplifyRanges`, () => {
    it.each([
      [[`*`], `*`],
      [[`*`, `^1.5.0`], `^1.5.0`],
      [[`^1.5.0`, `*`], `^1.5.0`],
      [[`^1.0.0 || ^2.0.0`, `^1.5.0`, `*`], `^1.5.0`],
      [[`^1.0.0`], `^1.0.0`],
      [[`^1.0.0`, `^1.5.0`], `^1.5.0`],
      [[`^1.0.0`, `^1.5.3`, `^1.5.0`], `^1.5.3`],
      [[`>=1.0.0`, `<2.0.0-0`], `^1.0.0`],
      [[`>=1.0.0`, `>=1.5.0`, `<2.0.0-0`], `^1.5.0`],
      [[`^1.0.0 || ^2.0.0`, `^1.5.0`], `^1.5.0`],
      [[`^1.0.0 || ^2.0.0`, `^2.5.0`], `^2.5.0`],
      [[`^1.0.0 || ^2.0.0`, `^1.5.0 || ^2.0.0`, `^1.3.0 || ^2.6.0`], `^1.5.0 || ^2.6.0`],
      [[`^1.0.0`, `1.5.3`], `1.5.3`],
      [[`>1.6.0`, `1.5.3`], null],
      [[`>1.5.3`, `1.5.3`], null],
      [[`>=1.5.3`, `1.5.3`], `1.5.3`],
      [[`<1.5.3`, `1.5.3`], null],
      [[`<=1.5.3`, `1.5.3`], `1.5.3`],
      [[`1.5.3`, `1.5.3`], `1.5.3`],
      [[`1.5.0`, `1.5.3`], null],
    ])(`should simplify %s into %s`, (ranges, expected) => {
      expect(semverUtils.simplifyRanges(ranges)).toEqual(expected);
    });
  });
});
