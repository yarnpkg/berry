import {Filename, PortablePath, npath, ppath}                 from '@yarnpkg/fslib';
import {PnpApi}                                               from '@yarnpkg/pnp';

import {Wrapper, GenerateIntegrationWrapper, IntegrationSdks} from '../generateSdk';
import * as sdkUtils                                          from '../sdkUtils';

export enum CocVimConfiguration {
  settings = `coc-settings.json`,
}

export const addCocVimWorkspaceConfiguration = async (pnpApi: PnpApi, type: CocVimConfiguration, patch: any) => {
  const relativeFilePath = `.vim/${type}` as PortablePath;
  await sdkUtils.addSettingWorkspaceConfiguration(pnpApi, relativeFilePath, patch);
};

export const generateEslintWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addCocVimWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`eslint.packageManager`]: `yarn`,
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(Filename.manifest),
      )),
    ),
  });
};

export const generateTypescriptWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addCocVimWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`workspace.workspaceFolderCheckCwd`]: false,
    [`tsserver.tsdk`]: npath.fromPortablePath(
      ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/tsserver.js` as PortablePath,
        ),
      ),
    ),
  });
};

export const generateOxfmtWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addCocVimWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`oxc.oxfmt.binPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        ppath.normalize(wrapper.manifest.bin.oxfmt),
      ),
    ),
  });
};

export const generateOxlintWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addCocVimWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`oxc.oxlint.binPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        ppath.normalize(wrapper.manifest.bin.oxlint),
      ),
    ),
  });
};

export const COC_VIM_SDKS: IntegrationSdks = [
  [`eslint`, generateEslintWrapper],
  [`typescript`, generateTypescriptWrapper],
  [`oxfmt`, generateOxfmtWrapper],
  [`oxlint`, generateOxlintWrapper],
];
