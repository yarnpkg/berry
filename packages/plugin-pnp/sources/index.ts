import {Hooks as CoreHooks, Plugin, Project, SettingsType, WindowsLinkType} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}                          from '@yarnpkg/fslib';
import {Hooks as StageHooks}                                                from '@yarnpkg/plugin-stage';
import {pathToFileURL}                                                      from 'url';

import {PnpLinker}                                                          from './PnpLinker';
import UnplugCommand                                                        from './commands/unplug';
import * as jsInstallUtils                                                  from './jsInstallUtils';
import * as pnpUtils                                                        from './pnpUtils';

export {UnplugCommand};
export {jsInstallUtils};
export {pnpUtils};

export const getPnpPath = (project: Project) => {
  return {
    cjs: ppath.join(project.cwd, Filename.pnpCjs),
    data: ppath.join(project.cwd, Filename.pnpData),
    esmLoader: ppath.join(project.cwd, Filename.pnpEsmLoader),
  };
};

export const quotePathIfNeeded = (path: string) => {
  return /\s/.test(path) ? JSON.stringify(path) : path;
};

async function setupScriptEnvironment(project: Project, env: NodeJS.ProcessEnv, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  // We still support .pnp.js files to improve multi-project compatibility.
  // TODO: Drop the question mark in the RegExp after .pnp.js files stop being used.
  // TODO: Support `-r` as an alias for `--require` (in all packages)
  const pnpRegularExpression = /\s*--require\s+\S*\.pnp\.c?js\s*/g;
  const esmLoaderExpression = /\s*--experimental-loader\s+\S*\.pnp\.loader\.mjs\s*/;

  const nodeOptions = (env.NODE_OPTIONS ?? ``)
    .replace(pnpRegularExpression, ` `)
    .replace(esmLoaderExpression, ` `)
    .trim();

  // We remove the PnP hook from NODE_OPTIONS because the process can have
  // NODE_OPTIONS set while changing linkers, which affects build scripts.
  if (project.configuration.get(`nodeLinker`) !== `pnp`) {
    // When set to an empty string, some tools consider it as explicitly set
    // to the empty value, and do not set their own value.
    env.NODE_OPTIONS = nodeOptions ? nodeOptions : undefined;
    return;
  }

  const pnpPath = getPnpPath(project);
  let pnpRequire = `--require ${quotePathIfNeeded(npath.fromPortablePath(pnpPath.cjs))}`;

  if (xfs.existsSync(pnpPath.esmLoader))
    pnpRequire = `${pnpRequire} --experimental-loader ${pathToFileURL(npath.fromPortablePath(pnpPath.esmLoader)).href}`;

  if (xfs.existsSync(pnpPath.cjs)) {
    env.NODE_OPTIONS = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;
  }
}

async function populateYarnPaths(project: Project, definePath: (path: PortablePath | null) => void) {
  const pnpPath = getPnpPath(project);
  definePath(pnpPath.cjs);
  definePath(pnpPath.data);
  definePath(pnpPath.esmLoader);

  definePath(project.configuration.get(`pnpUnpluggedFolder`));
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    nodeLinker: string;
    winLinkType: string;
    pnpMode: string;
    pnpShebang: string;
    pnpIgnorePatterns: Array<string>;
    pnpEnableEsmLoader: boolean;
    pnpEnableInlining: boolean;
    pnpFallbackMode: string;
    pnpUnpluggedFolder: PortablePath;
  }
}

const plugin: Plugin<CoreHooks & StageHooks> = {
  hooks: {
    populateYarnPaths,
    setupScriptEnvironment,
  },
  configuration: {
    nodeLinker: {
      description: `The linker used for installing Node packages, one of: "pnp", "pnpm", or "node-modules"`,
      type: SettingsType.STRING,
      default: `pnp`,
    },
    winLinkType: {
      description: `Whether Yarn should use Windows Junctions or symlinks when creating links on Windows.`,
      type: SettingsType.STRING,
      values: [
        WindowsLinkType.JUNCTIONS,
        WindowsLinkType.SYMLINKS,
      ],
      default: WindowsLinkType.JUNCTIONS,
    },
    pnpMode: {
      description: `If 'strict', generates standard PnP maps. If 'loose', merges them with the n_m resolution.`,
      type: SettingsType.STRING,
      default: `strict`,
    },
    pnpShebang: {
      description: `String to prepend to the generated PnP script`,
      type: SettingsType.STRING,
      default: `#!/usr/bin/env node`,
    },
    pnpIgnorePatterns: {
      description: `Array of glob patterns; files matching them will use the classic resolution`,
      type: SettingsType.STRING,
      default: [],
      isArray: true,
    },
    pnpEnableEsmLoader: {
      description: `If true, Yarn will generate an ESM loader (\`.pnp.loader.mjs\`). If this is not explicitly set Yarn tries to automatically detect whether ESM support is required.`,
      type: SettingsType.BOOLEAN,
      default: false,
    },
    pnpEnableInlining: {
      description: `If true, the PnP data will be inlined along with the generated loader`,
      type: SettingsType.BOOLEAN,
      default: true,
    },
    pnpFallbackMode: {
      description: `If true, the generated PnP loader will follow the top-level fallback rule`,
      type: SettingsType.STRING,
      default: `dependencies-only`,
    },
    pnpUnpluggedFolder: {
      description: `Folder where the unplugged packages must be stored`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.yarn/unplugged`,
    },
  },
  linkers: [
    PnpLinker,
  ],
  commands: [
    UnplugCommand,
  ],
};

export {PnpInstaller, PnpLinker} from './PnpLinker';

// eslint-disable-next-line arca/no-default-export
export default plugin;
