import {Configuration, Descriptor, Project, ResolveOptions, ThrowReport, structUtils, Locator, Cache, LocatorHash} from '@yarnpkg/core';
import {PortablePath, xfs, ppath}                                                                                  from '@yarnpkg/fslib';
import NpmPlugin                                                                                                   from '@yarnpkg/plugin-npm';
import PatchPlugin                                                                                                 from '@yarnpkg/plugin-patch';

import CompatPlugin                                                                                                from '../sources/index';

function getConfiguration(p: PortablePath) {
  const configuration = Configuration.create(p, p, new Map([
    [`@yarnpkg/plugin-compat`, CompatPlugin],
    [`@yarnpkg/plugin-npm`, NpmPlugin],
    [`@yarnpkg/plugin-patch`, PatchPlugin],
  ]));

  // The compatibility matrix intentionally checks prereleases such as TypeScript RCs.
  configuration.use(`<tests>`, {npmMinimalAgeGate: `0`}, p, {overwrite: true});

  return configuration;
}

async function createProject(configuration: Configuration, p: PortablePath, manifest: object = {}) {
  await xfs.writeFilePromise(ppath.join(p, `package.json`), JSON.stringify(manifest));

  return Project.find(configuration, p);
}

async function getDescriptorCandidates(descriptor: Descriptor) {
  return await xfs.mktempPromise(async dir => {
    const configuration = getConfiguration(dir);
    const {project} = await createProject(configuration, dir);

    const resolver = configuration.makeResolver();
    const resolveOptions: ResolveOptions = {project, resolver, report: new ThrowReport()};

    const normalizedDescriptor = configuration.normalizeDependency(descriptor);
    const candidates = await resolver.getCandidates(normalizedDescriptor, {}, resolveOptions);

    return candidates;
  });
}

/**
 * A Set used to keep track of the test candidates, so we only test each candidate once.
 */
const testedCandidates: Set<LocatorHash> = new Set();

async function testCandidate(locator: Locator) {
  if (testedCandidates.has(locator.locatorHash))
    return;

  testedCandidates.add(locator.locatorHash);

  await xfs.mktempPromise(async dir => {
    const configuration = getConfiguration(dir);
    const {project} = await createProject(configuration, dir, {
      dependencies: {
        [structUtils.stringifyIdent(locator)]: locator.reference,
      },
    });
    const cache = await Cache.find(configuration);

    await project.resolveEverything({
      cache,
      lockfileOnly: false,
      report: new ThrowReport(),
    });

    let error: Error | null = null;

    try {
      await project.fetchEverything({
        cache,
        report: new ThrowReport(),
      });
    } catch (e) {
      error = e;
    }

    if (error) {
      expect(error.message).not.toContain(`Cannot apply hunk`);
    }
  });
}

const TEST_TIMEOUT = 100000000;

const TEST_RANGES: Array<[string, Array<string>]> = [
  [
    `fsevents`, [
      `^1`,
      `^2.1`,
      `latest`,
    ],
  ], [
    `resolve`, [
      `>=1.9`,
      `latest`,
      `next`,
    ],
  ], [
    `typescript`, [
      `>=3.2`,
      `npm:@typescript/typescript6@^6.0.0`,
      `7.0.1-rc`,
      `latest`,
      `next`,
    ],
  ],
];

describe(`patches`, () => {
  describe.each(TEST_RANGES)(`%s`, (stringifiedIdent, ranges) => {
    const ident = structUtils.parseIdent(stringifiedIdent);

    it.each(ranges)(`should work with ${stringifiedIdent}@%s`, async range => {
      const descriptor = structUtils.makeDescriptor(ident, range);
      const candidates = await getDescriptorCandidates(descriptor);

      const errors = [];

      for (const candidate of candidates) {
        try {
          await testCandidate(candidate);
        } catch (error) {
          errors.push(`--- ${structUtils.stringifyLocator(candidate)} ---\n${error.stack}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(`\n`));
      }
    }, TEST_TIMEOUT);
  });
});
