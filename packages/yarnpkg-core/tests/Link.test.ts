import {ppath, npath, PortablePath, Filename, xfs} from '@yarnpkg/fslib';

import {generatePath}                              from '../sources/commands/link';
import {structUtils}                               from '@yarnpkg/core';

describe(`Link`, () => {
  describe(`generatePath`, () => {
    it(`handles Windows long paths correctly`, async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, `platform`, {
        value: `win32`,
      });

      try {
        const mockProject = {
          cwd: npath.toPortablePath(`C:\\very\\long\\path\\that\\exceeds\\windows\\limits\\project`) as PortablePath,
        };

        const mockLocator = structUtils.makeLocator(
          structUtils.makeIdent(`firebase`, `app-check`),
          `virtual:1234567890abcdef`,
        );

        const baseFs = new xfs.JailFS(mockProject.cwd);

        const result = await generatePath(mockLocator, {
          baseFs,
          project: mockProject as any,
          isDependency: true,
        });

        if (npath.fromPortablePath(result).length >= 260)
          expect(npath.fromPortablePath(result)).toMatch(/^\\\\\?\\./);


        await expect(baseFs.mkdirPromise(ppath.dirname(result), {recursive: true}))
          .resolves.not.toThrow();
      } finally {
        Object.defineProperty(process, `platform`, {
          value: originalPlatform,
        });
      }
    });
  });
});
