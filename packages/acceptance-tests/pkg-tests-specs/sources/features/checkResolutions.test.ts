import {structUtils}              from '@yarnpkg/core';
import {Filename, ppath, xfs}     from '@yarnpkg/fslib';
import {parseSyml, stringifySyml} from '@yarnpkg/parsers';

const tests: Array<[initial: string, replacement: string, valid: boolean]> = [
  [`no-deps@npm:^1.0.0`, `no-deps@npm:2.0.0`, false],
  [`no-deps@npm:^1.0.0`, `no-deps@npm:1.0.0`, true],

  [`no-deps@npm:^1.0.0`, `no-deps-bins@npm:1.0.0`, false],
  [`no-deps@npm:no-deps-bins@^1.0.0`, `no-deps-bins@npm:1.0.0`, true],

  [`util-deprecate@https://github.com/yarnpkg/util-deprecate.git#commit=4bcc600d20e3a53ea27fa52c4d1fc49cc2d0eabb`, `util-deprecate@https://github.com/yarnpkg/util-deprecate.git`, false],
  [`util-deprecate@https://github.com/yarnpkg/util-deprecate.git#commit=4bcc600d20e3a53ea27fa52c4d1fc49cc2d0eabb`, `util-deprecate@https://github.com/yarnpkg/util-deprecate.git#commit=475fb6857cd23fafff20c1be846c1350abf8e6d4`, false],
  [`util-deprecate@https://github.com/yarnpkg/util-deprecate.git#commit=4bcc600d20e3a53ea27fa52c4d1fc49cc2d0eabb`, `util-deprecate@https://github.com/yarnpkg/util-deprecate.git#commit=4bcc600d20e3a53ea27fa52c4d1fc49cc2d0eabb`, true],
];

describe(`Features`, () => {
  for (const [initial, replacement, valid] of tests) {
    it(
      `should ${valid ? `allow` : `prevent`} resolving "${initial}" with "${replacement}"`,
      makeTemporaryEnv({}, {
        // We don't care about this flag; in an actual attack,
        // the hash would be correct
        checksumBehavior: `ignore`,
      }, async ({path, run, source}) => {
        await run(`add`, replacement);

        const lockfilePath = ppath.join(path, Filename.lockfile);
        const lockfileContent = await xfs.readFilePromise(lockfilePath, `utf8`);
        const lockfileData = parseSyml(lockfileContent);

        lockfileData[initial] = {
          version: lockfileData[replacement].version,
          resolution: replacement,
          languageName: lockfileData[replacement].languageName,
          linkType: lockfileData[replacement].linkType,
        };

        await xfs.writeFilePromise(lockfilePath, stringifySyml(lockfileData));

        const manifestPath = ppath.join(path, Filename.manifest);
        const manifestData = await xfs.readJsonPromise(manifestPath);

        const descriptor = structUtils.parseDescriptor(initial);
        manifestData.dependencies = {
          [structUtils.stringifyIdent(descriptor)]: descriptor.range,
        };

        await xfs.writeJsonPromise(manifestPath, manifestData);

        const check = run(`install`, `--check-resolutions`);
        if (valid) {
          await check;
        } else {
          await expect(check).rejects.toThrow(/YN0078/);
        }
      }),
    );
  }
});
