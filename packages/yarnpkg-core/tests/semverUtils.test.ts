import * as semverUtils from '../sources/semverUtils';

const SPECS: Array<[string, string, boolean]> = [
  // Those three are different from includePrerelease
  [`^5.0.0`, `5.0.0-beta.13`, true],
  [`^1.0.0`, `1.0.0-rc1`, true],
  [`2.x`, `3.0.0-pre.0`, false],

  [`2.x`, `2.0.0-pre.0`, true],
  [`2.x`, `2.1.0-pre.0`, true],
  [`*`, `1.0.0-rc1`, true],
  [`^1.0.0-0`, `1.0.1-rc1`, true],
  [`^1.0.0-rc2`, `1.0.1-rc1`, true],
  [`^1.0.0`, `1.0.1-rc1`, true],
  [`^1.0.0`, `1.1.0-rc1`, true],

  [`^1.0.0`, `2.0.0-rc1`, false],
  [`^1.2.3-rc2`, `2.0.0`, false],
];

describe(`semverUtils`, () => {
  for (const [range, version, satisfied] of SPECS) {
    it(`should satisfy ${range} with ${version}`, () => {
      expect(semverUtils.satisfiesWithPrereleases(version, range)).toEqual(satisfied);
    });
  }
});
