import '@yarnpkg/cli/polyfills';
import {nodeUtils}              from '@yarnpkg/core';
import {npath, ppath}           from '@yarnpkg/fslib';
import {startupSnapshot}        from 'v8';

import {runExit}                from './lib';
import {getPluginConfiguration} from './tools/getPluginConfiguration';

nodeUtils.inhibateWarning(/built-in module .* is not yet supported in user snapshots/);

declare module 'v8' {
  export const startupSnapshot: {
    isBuildingSnapshot(): boolean;
    setDeserializeMainFunction(fn: () => void): void;
  };
}

function start() {
  runExit(process.argv.slice(2), {
    cwd: ppath.cwd(),
    selfPath: npath.toPortablePath(npath.resolve(process.argv[1])),
    pluginConfiguration: getPluginConfiguration(),
  });
}

if (!startupSnapshot.isBuildingSnapshot()) {
  start();
} else {
  startupSnapshot.setDeserializeMainFunction(() => {
    start();
  });
}
