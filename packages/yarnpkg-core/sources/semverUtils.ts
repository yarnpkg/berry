import semver from 'semver';

/**
 * Returns whether the given semver version satisfies the given range. Notably
 * this supports prerelease versions so that "2.0.0-rc.0" satisfies the range
 * ">=1.0.0", for example.
 *
 * This function exists because the semver.satisfies method does not include
 * pre releases. This means ranges such as * would not satisfy 1.0.0-rc. The
 * includePrerelease flag has a weird behavior and cannot be used (if you want
 * to try it out, just run the `semverUtils` testsuite using this flag instead
 * of our own implementation, and you'll see the failing cases).
 *
 * See https://github.com/yarnpkg/berry/issues/575 for more context.
 */
export function satisfiesWithPrereleases(version: string | null, range: string, loose: boolean = false): boolean {
  let semverRange;
  try {
    semverRange = new semver.Range(range, loose);
  } catch (err) {
    return false;
  }

  if (!version)
    return false;

  let semverVersion: semver.SemVer;
  try {
    semverVersion = new semver.SemVer(version, semverRange.loose);
    if (semverVersion.prerelease) {
      semverVersion.prerelease = [];
    }
  } catch (err) {
    return false;
  }

  // A range has multiple sets of comparators. A version must satisfy all
  // comparators in a set and at least one set to satisfy the range.
  return semverRange.set.some(comparatorSet => {
    for (const comparator of comparatorSet)
      if (comparator.semver.prerelease)
        comparator.semver.prerelease = [];

    return comparatorSet.every(comparator => {
      return comparator.test(semverVersion);
    });
  });
}
