import {Configuration, Descriptor, Project, ResolveOptions, ThrowReport, structUtils, Locator, Cache, LocatorHash} from '@yarnpkg/core';
import {PortablePath, xfs, ppath, toFilename}                                                                      from '@yarnpkg/fslib';
import NpmPlugin                                                                                                   from '@yarnpkg/plugin-npm';
import PatchPlugin                                                                                                 from '@yarnpkg/plugin-patch';

import CompatPlugin                                                                                                from '../sources/index';

function getConfiguration(p: PortablePath) {
  return new Configuration(p, p, new Map([
    [`@yarnpkg/plugin-compat`, CompatPlugin],
    [`@yarnpkg/plugin-npm`, NpmPlugin],
    [`@yarnpkg/plugin-patch`, PatchPlugin],
  ]));
};

async function createProject(configuration: Configuration, p: PortablePath, manifest?: object = {}) {
  await xfs.writeFilePromise(ppath.join(p, toFilename(`package.json`)), JSON.stringify(manifest));

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

    await expect(project.fetchEverything({
      cache,
      report: new ThrowReport(),
    })).resolves.toBeUndefined();
  });
}

const TEST_TIMEOUT = 100000000;

const TEST_RANGES: Array<[string, string[]]> = [
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
      `>=3.0 <3.6`,
      `>=3.6 <3.9`,
      `>=3.9`,
      `latest`,
      `rc`,
      `beta`,
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

      for (const candidate of candidates) {
        await testCandidate(candidate);
      }
    }, TEST_TIMEOUT);
  });
});
