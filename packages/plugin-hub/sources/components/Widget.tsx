import dateformat = require('dateformat');

import {Project}     from '@berry/core';
import {structUtils} from '@berry/core';
import {hostname}    from 'os';

export type Widget = () => string;

export const Hostname = () => {
  return `"${hostname()}"`;
};

export const Time = () => {
  return dateformat(new Date(), `HH:MM dd-mmm-yy`);
};

export const ProjectName = (project: Project) => () => {
  const topLevelWorkspace = project.workspacesByCwd.get(project.cwd);

  if (!topLevelWorkspace)
    return `notfound`;

  return structUtils.stringifyIdent(topLevelWorkspace.locator);
};
