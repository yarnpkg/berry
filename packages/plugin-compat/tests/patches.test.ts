import {Configuration, Descriptor, Project, ResolveOptions, ThrowReport, structUtils, Locator, Cache, LocatorHash} from '@yarnpkg/core';
import {PortablePath, xfs, ppath, Filename}                                                                        from '@yarnpkg/fslib';
import NpmPlugin                                                                                                   from '@yarnpkg/plugin-npm';
import PatchPlugin                                                                                                 from '@yarnpkg/plugin-patch';

import CompatPlugin                                                                                                from '../sources/index';

function getConfiguration(p: PortablePath) {
  return Configuration.create(p, p, new Map([
    [`@yarnpkg/plugin-compat`, CompatPlugin],
    [`@yarnpkg/plugin-npm`, NpmPlugin],
    [`@yarnpkg/plugin-patch`, PatchPlugin],
  ]));
}

async function createProject(configuration: Configuration, p: PortablePath, manifest: object = {}) {
  await xfs.writeFilePromise(ppath.join(p, `package.json` as Filename), JSON.stringify(manifest));

  return Project.find(configuration, p);
}

async function getDescriptorCandidates(descriptor: Descriptor) {
  return await xfs.mktempPromise(async dir => {
    const configuration = getConfiguration(dir);
    const {project} = await createProject(configuration, dir);

    const resolver = configuration.makeResolver();
    const resolveOptions: ResolveOptions = {project, resolver, report: new ThrowReport()};

    const candidates = await resolver.getCandidates(descriptor, new Map(), resolveOptions);

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
