import {Project}         from '@yarnpkg/core';
import {Filename, ppath} from '@yarnpkg/fslib';

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
