import {Hooks as CoreHooks, Plugin, Project, SettingsType} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}         from '@yarnpkg/fslib';
import {Hooks as StageHooks}                               from '@yarnpkg/plugin-stage';
import semver                                              from 'semver';
import {pathToFileURL}                                     from 'url';

import {PnpLinker}                                         from './PnpLinker';
import unplug                                              from './commands/unplug';
import * as jsInstallUtils                                 from './jsInstallUtils';
import * as pnpUtils                                       from './pnpUtils';

export {jsInstallUtils};
export {pnpUtils};

export const getPnpPath = (project: Project) => {
  return {
    cjs: ppath.join(project.cwd, Filename.pnpCjs),
    cjsLegacy: ppath.join(project.cwd, Filename.pnpJs),
    esmLoader: ppath.join(project.cwd, `.pnp.loader.mjs` as Filename),
  };
};

export const quotePathIfNeeded = (path: string) => {
  return /\s/.test(path) ? JSON.stringify(path) : path;
};

async function setupScriptEnvironment(project: Project, env: {[key: string]: string}, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  const pnpPath = getPnpPath(project);
  let pnpRequire = `--require ${quotePathIfNeeded(npath.fromPortablePath(pnpPath.cjs))}`;

  if (xfs.existsSync(pnpPath.esmLoader))
    pnpRequire = `${pnpRequire} --experimental-loader ${pathToFileURL(npath.fromPortablePath(pnpPath.esmLoader)).href}`;

  if (pnpPath.cjs.includes(` `) && semver.lt(process.versions.node, `12.0.0`))
    throw new Error(`Expected the build location to not include spaces when using Node < 12.0.0 (${process.versions.node})`);

  if (xfs.existsSync(pnpPath.cjs)) {
    let nodeOptions = env.NODE_OPTIONS || ``;

    // We still support .pnp.js files to improve multi-project compatibility.
    // TODO: Drop the question mark in the RegExp after .pnp.js files stop being used.
    const pnpRegularExpression = /\s*--require\s+\S*\.pnp\.c?js\s*/g;
    const esmLoaderExpression = /\s*--experimental-loader\s+\S*\.pnp\.loader\.mjs\s*/;
    nodeOptions = nodeOptions.replace(pnpRegularExpression, ` `).replace(esmLoaderExpression, ` `).trim();

    nodeOptions = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;

    env.NODE_OPTIONS = nodeOptions;
  }
}

async function populateYarnPaths(project: Project, definePath: (path: PortablePath | null) => void) {
  const pnpPath = getPnpPath(project);
  definePath(pnpPath.cjs);
  definePath(pnpPath.esmLoader);

  definePath(project.configuration.get(`pnpDataPath`));
  definePath(project.configuration.get(`pnpUnpluggedFolder`));
}

declare module '@yarnpkg/core' {
  interface ConfigurationValueMap {
    nodeLinker: string;
    pnpMode: string;
    pnpShebang: string;
    pnpIgnorePatterns: Array<string>;
    pnpEnableEsmLoader: boolean;
    pnpEnableInlining: boolean;
    pnpFallbackMode: string;
    pnpUnpluggedFolder: PortablePath;
    pnpDataPath: PortablePath;
  }
}

const plugin: Plugin<CoreHooks & StageHooks> = {
  hooks: {
    populateYarnPaths,
    setupScriptEnvironment,
  },
  configuration: {
    nodeLinker: {
      description: `The linker used for installing Node packages, one of: "pnp", "node-modules"`,
      type: SettingsType.STRING,
      default: `pnp`,
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
    pnpDataPath: {
      description: `Path of the file where the PnP data (used by the loader) must be written`,
      type: SettingsType.ABSOLUTE_PATH,
      default: `./.pnp.data.json`,
    },
  },
  linkers: [
    PnpLinker,
  ],
  commands: [
    unplug,
  ],
};

export {PnpInstaller, PnpLinker} from './PnpLinker';

// eslint-disable-next-line arca/no-default-export
export default plugin;
