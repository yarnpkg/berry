import semver from 'semver';

export {SemVer} from 'semver';

const satisfiesWithPrereleasesCache = new Map<string, semver.Range | null>();

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
  if (!version)
    return false;

  const key = `${range}${loose}`;
  let semverRange = satisfiesWithPrereleasesCache.get(key);
  if (typeof semverRange === `undefined`) {
    try {
      // eslint-disable-next-line no-restricted-properties
      semverRange = new semver.Range(range, {includePrerelease: true, loose});
    } catch {
      return false;
    } finally {
      satisfiesWithPrereleasesCache.set(key, semverRange || null);
    }
  } else if (semverRange === null) {
    return false;
  }

  let semverVersion: semver.SemVer;
  try {
    semverVersion = new semver.SemVer(version, semverRange);
  } catch (err) {
    return false;
  }

  if (semverRange.test(semverVersion))
    return true;

  if (semverVersion.prerelease)
    semverVersion.prerelease = [];

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

const rangesCache = new Map<string, semver.Range | null>();
/**
 * A cached version of `new semver.Range(potentialRange)` that returns `null` on invalid ranges
 */
export function validRange(potentialRange: string): semver.Range | null {
  if (potentialRange.indexOf(`:`) !== -1)
    return null;

  let range = rangesCache.get(potentialRange);
  if (typeof range !== `undefined`)
    return range;

  try {
    // eslint-disable-next-line no-restricted-properties
    range = new semver.Range(potentialRange);
  } catch {
    range = null;
  }

  rangesCache.set(potentialRange, range);
  return range;
}

/**
 The RegExp from https://semver.org/ but modified to
 - allow the version to start with `(?:[\sv=]*?)`
 - allow the version to end with `(?:\s*)`
 - place the valid version in capture group one
 */
const CLEAN_SEMVER_REGEXP = /^(?:[\sv=]*?)((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?)(?:\s*)$/;

/**
 * Cleans the potential version by removing leading/trailing whitespace and '=v' prefix
 * @returns A valid SemVer string, otherwise null
 */
export function clean(potentialVersion: string): string | null {
  const version = CLEAN_SEMVER_REGEXP.exec(potentialVersion);
  return version ? version[1] : null;
}

export type Comparator = {
  gt: [`>` | `>=`, semver.SemVer] | null;
  lt: [`<` | `<=`, semver.SemVer] | null;
};

export function getComparator(comparators: semver.Comparator): Comparator {
  // @ts-expect-error: The ANY symbol isn't well declared
  if (comparators.semver === semver.Comparator.ANY)
    return {gt: null, lt: null};

  switch (comparators.operator) {
    case ``:
      return {gt: [`>=`, comparators.semver], lt: [`<=`, comparators.semver]};

    case `>`:
    case `>=`:
      return {gt: [comparators.operator, comparators.semver], lt: null};

    case `<`:
    case `<=`:
      return {gt: null, lt: [comparators.operator, comparators.semver]};

    default: {
      throw new Error(`Assertion failed: Unexpected comparator operator (${comparators.operator})`);
    }
  }
}

export function mergeComparators(comparators: Array<Comparator>) {
  if (comparators.length === 0)
    return null;

  let maxGtComparator: Comparator[`gt`] | null = null;
  let minLtComparator: Comparator[`lt`] | null = null;

  for (const comparator of comparators) {
    if (comparator.gt) {
      const cmp = maxGtComparator !== null
        ? semver.compare(comparator.gt[1], maxGtComparator[1])
        : null;

      if (cmp === null || cmp > 0 || (cmp === 0 && comparator.gt[0] === `>`)) {
        maxGtComparator = comparator.gt;
      }
    }

    if (comparator.lt) {
      const cmp = minLtComparator !== null
        ? semver.compare(comparator.lt[1], minLtComparator[1])
        : null;

      if (cmp === null || cmp < 0 || (cmp === 0 && comparator.lt[0] === `<`)) {
        minLtComparator = comparator.lt;
      }
    }
  }

  if (maxGtComparator && minLtComparator) {
    const cmp = semver.compare(maxGtComparator[1], minLtComparator[1]);
    if (cmp === 0 && (maxGtComparator[0] === `>` || minLtComparator[0] === `<`))
      return null;

    if (cmp > 0) {
      return null;
    }
  }

  return {
    gt: maxGtComparator,
    lt: minLtComparator,
  };
}

export function stringifyComparator(comparator: Comparator) {
  if (comparator.gt && comparator.lt) {
    if (comparator.gt[0] === `>=` && comparator.lt[0] === `<=` && comparator.gt[1].version === comparator.lt[1].version)
      return comparator.gt[1].version;

    if (comparator.gt[0] === `>=` && comparator.lt[0] === `<`) {
      if (comparator.lt[1].version === `${comparator.gt[1].major + 1}.0.0-0`)
        return `^${comparator.gt[1].version}`;

      if (comparator.lt[1].version === `${comparator.gt[1].major}.${comparator.gt[1].minor + 1}.0-0`) {
        return `~${comparator.gt[1].version}`;
      }
    }
  }

  const parts = [];

  if (comparator.gt)
    parts.push(comparator.gt[0] + comparator.gt[1].version);
  if (comparator.lt)
    parts.push(comparator.lt[0] + comparator.lt[1].version);

  if (!parts.length)
    return `*`;

  return parts.join(` `);
}

export function simplifyRanges(ranges: Array<string>) {
  const parsedRanges = ranges.map(range => validRange(range)!.set.map(comparators => comparators.map(comparator => getComparator(comparator))));

  let alternatives = parsedRanges.shift()!.map(comparators => mergeComparators(comparators))
    .filter((range): range is Comparator => range !== null);

  for (const parsedRange of parsedRanges) {
    const nextAlternatives = [];

    for (const comparator of alternatives) {
      for (const refiners of parsedRange) {
        const nextComparators = mergeComparators([
          comparator,
          ...refiners,
        ]);

        if (nextComparators !== null) {
          nextAlternatives.push(nextComparators);
        }
      }
    }

    alternatives = nextAlternatives;
  }

  if (alternatives.length === 0)
    return null;

  return alternatives.map(comparator => stringifyComparator(comparator)).join(` || `);
}
