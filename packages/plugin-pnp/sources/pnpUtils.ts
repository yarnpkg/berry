import {Locator, structUtils, Configuration} from '@yarnpkg/core';
import {ppath}                               from '@yarnpkg/fslib';

export function getUnpluggedPath(locator: Locator, {configuration}: {configuration: Configuration}) {
  return ppath.resolve(configuration.get(`pnpUnpluggedFolder`), structUtils.slugifyLocator(locator));
}
