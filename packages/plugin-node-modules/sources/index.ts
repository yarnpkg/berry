import {Plugin, Project} from '@yarnpkg/core';
import {Filename, ppath} from '@yarnpkg/fslib';

import {PnpLinker}       from './NodeModulesLinker';

export const getPnpPath = (project: Project) => ppath.join(project.cwd, `.pnp.js` as Filename);

const plugin: Plugin = {
  linkers: [
    PnpLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
