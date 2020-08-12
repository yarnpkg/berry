import {Configuration, Locator, structUtils, Project} from '@yarnpkg/core';
import {ppath, Filename}                              from '@yarnpkg/fslib';

export function getPackagePath(locator: Locator, {configuration}: {configuration: Configuration}) {
  return ppath.join(configuration.get(`cmakeVendorFolder`), structUtils.slugifyLocator(locator));
}

export function getCmakeDefsPath(project: Project) {
  return ppath.join(project.cwd, `CMakeYarn.cmake` as Filename);
}

export function getPathmapPath(configuration: Configuration) {
  return ppath.join(configuration.get(`cmakeVendorFolder`), `pathmap.json` as Filename);
}
