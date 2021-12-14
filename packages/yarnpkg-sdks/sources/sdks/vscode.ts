import {PortablePath, npath, ppath}                                                   from '@yarnpkg/fslib';
import {PnpApi}                                                                       from '@yarnpkg/pnp';

import {Wrapper, GenerateIntegrationWrapper, GenerateDefaultWrapper, IntegrationSdks} from '../generateSdk';
import * as sdkUtils                                                                  from '../sdkUtils';

export enum VSCodeConfiguration {
  settings = `settings.json`,
  extensions = `extensions.json`,
}

export const addVSCodeWorkspaceConfiguration = async (pnpApi: PnpApi, type: VSCodeConfiguration, patch: any) => {
  const relativeFilePath = `.vscode/${type}` as PortablePath;
  await sdkUtils.addSettingWorkspaceConfiguration(pnpApi, relativeFilePath, patch);
};

export const generateDefaultWrapper: GenerateDefaultWrapper = async (pnpApi: PnpApi) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`search.exclude`]: {
      [`**/.yarn`]: true,
      [`**/.pnp.*`]: true,
    },
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `arcanis.vscode-zipfs`,
    ],
  });
};

export const generateEslintWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/api.js` as PortablePath,
        ),
      ))),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `dbaeumer.vscode-eslint`,
    ],
  });
};

export const generatePrettierWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`prettier.prettierPath`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `index.js` as PortablePath,
      ),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `esbenp.prettier-vscode`,
    ],
  });
};

export const generateTypescriptWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`typescript.tsdk`]: npath.fromPortablePath(
      ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/tsserver.js` as PortablePath,
        ),
      ),
    ),
    [`typescript.enablePromptUseWorkspaceTsdk`]: true,
  });
};

export const generateSvelteLanguageServerWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`svelte.language-server.ls-path`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `bin/server.js` as PortablePath,
      ),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `svelte.svelte-vscode`,
    ],
  });
};

export const generateFlowBinWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`flow.pathToFlow`]: npath.fromPortablePath(
      `\${workspaceFolder}/${wrapper.getProjectPathTo(
        `cli.js` as PortablePath,
      )}`,
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `flowtype.flow-for-vscode`,
    ],
  });
};

export const VSCODE_SDKS: IntegrationSdks = [
  [null, generateDefaultWrapper],
  [`eslint`, generateEslintWrapper],
  [`prettier`, generatePrettierWrapper],
  [`typescript-language-server`, null],
  [`typescript`, generateTypescriptWrapper],
  [`svelte-language-server`, generateSvelteLanguageServerWrapper],
  [`flow-bin`, generateFlowBinWrapper],
];
