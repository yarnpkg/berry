import {Hooks as CoreHooks, Plugin, Project, SettingsType} from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, xfs}         from '@yarnpkg/fslib';
import {Hooks as StageHooks}                               from '@yarnpkg/plugin-stage';

import semver                                              from 'semver';

import {PnpLinker}                                         from './PnpLinker';
import unplug                                              from './commands/unplug';

export const getPnpPath = (project: Project) => {
  let mainFilename;
  let otherFilename;

  if (project.topLevelWorkspace.manifest.type === `module`) {
    mainFilename = `.pnp.cjs`;
    otherFilename = `.pnp.js`;
  } else {
    mainFilename = `.pnp.js`;
    otherFilename = `.pnp.cjs`;
  }

  return {
    main: ppath.join(project.cwd, mainFilename as Filename),
    other: ppath.join(project.cwd, otherFilename as Filename),
  };
};

export const quotePathIfNeeded = (path: string) => {
  return /\s/.test(path) ? JSON.stringify(path) : path;
};

async function setupScriptEnvironment(project: Project, env: {[key: string]: string}, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  const pnpPath: PortablePath = getPnpPath(project).main;
  const pnpRequire = `--require ${quotePathIfNeeded(npath.fromPortablePath(pnpPath))}`;

  if (pnpPath.includes(` `) && semver.lt(process.versions.node, `12.0.0`))
    throw new Error(`Expected the build location to not include spaces when using Node < 12.0.0 (${process.versions.node})`);

  if (xfs.existsSync(pnpPath)) {
    let nodeOptions = env.NODE_OPTIONS || ``;

    const pnpRegularExpression = /\s*--require\s+\S*\.pnp\.c?js\s*/g;
    nodeOptions = nodeOptions.replace(pnpRegularExpression, ` `).trim();

    nodeOptions = nodeOptions ? `${pnpRequire} ${nodeOptions}` : pnpRequire;

    env.NODE_OPTIONS = nodeOptions;
  }
}

async function populateYarnPaths(project: Project, definePath: (path: PortablePath | null) => void) {
  definePath(getPnpPath(project).main);
  definePath(getPnpPath(project).other);

  definePath(project.configuration.get(`pnpDataPath`));
  definePath(project.configuration.get(`pnpUnpluggedFolder`));
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

export {AbstractPnpInstaller} from './AbstractPnpInstaller';
export {PnpInstaller, PnpLinker} from './PnpLinker';

// eslint-disable-next-line arca/no-default-export
export default plugin;
