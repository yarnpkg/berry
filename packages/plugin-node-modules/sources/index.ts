import {Plugin, Project}   from '@yarnpkg/core';
import {Filename, ppath}   from '@yarnpkg/fslib';

import {NodeModulesLinker} from './NodeModulesLinker';
import {PnpLooseLinker}    from './PnpLooseLinker';

export const getPnpPath = (project: Project) => ppath.join(project.cwd, `.pnp.js` as Filename);

const plugin: Plugin = {
  linkers: [
    NodeModulesLinker,
    PnpLooseLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
