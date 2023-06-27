import './polyfills';

// eslint-disable-next-line arca/import-ordering
import {YarnVersion}            from '@yarnpkg/core';

import {main}                   from './main';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

export {getDynamicLibs} from "./tools/getDynamicLibs";

export function run() {
  main({
    binaryVersion: YarnVersion || `<unknown>`,
    pluginConfiguration: getPluginConfiguration(),
  });
}

if (require.main === module)
  run();
