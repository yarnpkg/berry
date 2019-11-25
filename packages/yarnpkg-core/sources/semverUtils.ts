import semver from 'semver';

/**
 * Returns whether the given semver version satisfies the given range. Notably this supports
 * prerelease versions so that "2.0.0-rc.0" satisfies the range ">=1.0.0", for example.
 *
 * This function exists because the semver.satisfies method does not include pre releases. This means
 * ranges such as * would not satisfy 1.0.0-rc. Setting includePrerelease to true fixes the issue
 * but introduces a subtle problem where a range such as ^1.0.0 is satisfied by the version 2.0.0-rc.
 * This method is similar to the semver.satisfies with includeRerelease set to true without the inclusion
 * of major version pre releases as highlighted above.
 *
 * See https://github.com/yarnpkg/berry/issues/575 and https://github.com/yarnpkg/berry/issues/575
 * for more context.
 *
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
  } catch (err) {
    return false;
  }

  // A range has multiple sets of comparators. A version must satisfy all comparators in a set
  // and at least one set to satisfy the range.
  return semverRange.set.some(comparatorSet => {
    // node-semver converts ~ and ^ ranges into pairs of >= and < ranges but the upper bounds don't
    // properly exclude prerelease versions. For example, "^1.0.0" is converted to ">=1.0.0 <2.0.0",
    // which includes "2.0.0-pre" since prerelease versions are lower than their non-prerelease
    // counterparts. As a practical workaround we make upper-bound ranges exclude prereleases and
    // convert "<2.0.0" to "<2.0.0-0", for example.
    comparatorSet = comparatorSet.map(comparator => {
      if (comparator.operator !== '<' || !comparator.value || comparator.semver.prerelease.length)
        return comparator;


      // "0" is the lowest prerelease version. Note the typings for inc() are incorrect
      // and the following massages the types to achieve the same functionality as the
      // yarn v1 functionality.
      comparator.semver.inc('pre' as semver.ReleaseType, 0 as unknown as string);

      const comparatorString = comparator.operator + comparator.semver.version;
      // $FlowFixMe: Add a definition for the Comparator class
      return new semver.Comparator(comparatorString, comparator.loose);
    });

    return !comparatorSet.some(comparator => !comparator.test(semverVersion));
  });
}