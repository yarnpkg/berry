import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                          from '@yarnpkg/pnp';

import {Wrapper} from '../sources/generateSdk';
import {generateTypescriptWrapper} from '../sources/sdks/vscode';

const makePnpApi = (projectRoot: PortablePath) => {
  return {
    topLevel: {
      name: null,
      reference: null,
    },

    getPackageInformation: () => ({
      packageLocation: npath.fromPortablePath(projectRoot),
    }),
  } as unknown as PnpApi;
};

const makeTypescriptWrapper = () => {
  return {
    getProjectPathTo: () =>
      `.yarn/sdks/typescript/lib/tsserver.js` as PortablePath,
  } as unknown as Wrapper;
};

describe(`VSCode SDK settings`, () => {
  it(`should generate the unified JavaScript and TypeScript settings`, async () => {
    await xfs.mktempPromise(async projectRoot => {
      const pnpApi = makePnpApi(projectRoot);
      const wrapper = makeTypescriptWrapper();

      await generateTypescriptWrapper(
        pnpApi,
        PortablePath.dot,
        wrapper,
      );

      const settingsPath = ppath.join(
        projectRoot,
        `.vscode/settings.json` as PortablePath,
      );

      const settings = await xfs.readJsonPromise(settingsPath);

      expect(settings).toEqual({
        [`js/ts.tsdk.path`]: npath.fromPortablePath(
          `.yarn/sdks/typescript/lib` as PortablePath,
        ),
        [`js/ts.tsdk.promptToUseWorkspaceVersion`]: true,
      });
    });
  });

  it(`should remove deprecated TypeScript settings while preserving unrelated settings`, async () => {
    await xfs.mktempPromise(async projectRoot => {
      const settingsPath = ppath.join(
        projectRoot,
        `.vscode/settings.json` as PortablePath,
      );

      await xfs.mkdirPromise(ppath.dirname(settingsPath), {
        recursive: true,
      });

      await xfs.writeJsonPromise(settingsPath, {
        [`editor.formatOnSave`]: true,
        [`typescript.tsdk`]: `.yarn/sdks/typescript/lib`,
        [`typescript.enablePromptUseWorkspaceTsdk`]: true,
      });

      const pnpApi = makePnpApi(projectRoot);
      const wrapper = makeTypescriptWrapper();

      await generateTypescriptWrapper(
        pnpApi,
        PortablePath.dot,
        wrapper,
      );

      const settings = await xfs.readJsonPromise(settingsPath);

      expect(settings).toEqual({
        [`editor.formatOnSave`]: true,
        [`js/ts.tsdk.path`]: npath.fromPortablePath(
          `.yarn/sdks/typescript/lib` as PortablePath,
        ),
        [`js/ts.tsdk.promptToUseWorkspaceVersion`]: true,
      });

      expect(settings).not.toHaveProperty(`typescript.tsdk`);
      expect(settings).not.toHaveProperty(
        `typescript.enablePromptUseWorkspaceTsdk`,
      );
    });
  });
});
