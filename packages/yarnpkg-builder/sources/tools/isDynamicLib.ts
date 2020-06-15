import {getDynamicLibs} from '@yarnpkg/cli';

export const isDynamicLib = (request: string) => {
  if (getDynamicLibs().has(request))
    return true;

  if (request.match(/^@yarnpkg\/plugin-/))
    return true;

  return false;
};
