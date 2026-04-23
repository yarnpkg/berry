import {Filename, PortablePath, npath, ppath}                                         from '@yarnpkg/fslib';
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

export const removeVSCodeWorkspaceConfiguration = async (pnpApi: PnpApi, type: VSCodeConfiguration, patch: any) => {
  const relativeFilePath = `.vscode/${type}` as PortablePath;
  await sdkUtils.removeSettingWorkspaceConfiguration(pnpApi, relativeFilePath, patch);
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

export const generateAstroLanguageServerWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`astro.language-server.ls-path`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `bin/nodeServer.js` as PortablePath,
      ),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `astro-build.astro-vscode`,
    ],
  });
};

export const generateEslintWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(Filename.manifest),
      )),
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
        ppath.normalize(wrapper.manifest.main),
      ),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `esbenp.prettier-vscode`,
    ],
  });
};

export const generateRelayCompilerWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`relay.pathToRelay`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `cli.js` as PortablePath,
      ),
    ),
  });

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.extensions, {
    [`recommendations`]: [
      `meta.relay`,
    ],
  });
};

export const generateTypescriptWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  let patch = {};
  const [major, minor] = await getVSCodeVersion();
  const tsdkPath = npath.fromPortablePath(ppath.dirname(wrapper.getProjectPathTo(`lib/tsserver.js` as PortablePath)));

  if (major === undefined || minor === undefined) {
    // could not detect vscode version, use both for compatibility
    patch = {
      [`js/ts.tsdk.path`]: tsdkPath,
      [`js/ts.tsdk.promptToUseWorkspaceVersion`]: true,
      [`typescript.tsdk`]: tsdkPath,
      [`typescript.enablePromptUseWorkspaceTsdk`]: true,
    };
  } else if (major === 1 && minor < 110) {
    // use separate ts settings (old format)
    patch = {
      [`typescript.tsdk`]: tsdkPath,
      [`typescript.enablePromptUseWorkspaceTsdk`]: true,
    };
  } else {
    // use unified js/ts settings (new format)
    patch = {
      [`js/ts.tsdk.path`]: tsdkPath,
      [`js/ts.tsdk.promptToUseWorkspaceVersion`]: true,
    };
    // Remove old TypeScript settings if present to prevent deprecation warnings from vscode
    await removeVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, [
      `typescript.tsdk`,
      `typescript.enablePromptUseWorkspaceTsdk`,
    ]);
  }

  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, patch);
};

export const generateSvelteLanguageServerWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, VSCodeConfiguration.settings, {
    [`svelte.language-server.ls-path`]: npath.fromPortablePath(
      wrapper.getProjectPathTo(
        `bin/server.js` as PortablePath,
      ),
    ),
    [`svelte.language-server.runtime-args`]: [`--loader`, `./.pnp.loader.mjs`],
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
  [`@astrojs/language-server`, generateAstroLanguageServerWrapper],
  [`eslint`, generateEslintWrapper],
  [`prettier`, generatePrettierWrapper],
  [`relay-compiler`, generateRelayCompilerWrapper],
  [`typescript-language-server`, null],
  [`typescript`, generateTypescriptWrapper],
  [`svelte-language-server`, generateSvelteLanguageServerWrapper],
  [`flow-bin`, generateFlowBinWrapper],
];

async function getVSCodeVersion() {
  try {
    const command = `code${process.platform === `win32` && `.cmd`} --version`;
    const {stdout} = await sdkUtils.execPromise(`${command} --version`, {encoding: `utf8`, shell: `cmd.exe`});
    const version = stdout.split(`\n`)[0].trim();
    console.log(`VSCode version: v${version}`);
    return version.split(`.`).map(value => parseInt(value, 10));
  } catch {
    // VS Code CLI might not be in the PATH
    return [void 0, void 0];
  }
}
