import {Workspace} from '@berry/core';

export function writePublishConfigToManifest(workspace: Workspace, rawManifest: any) {
  if (rawManifest.publishConfig) {
    if (rawManifest.publishConfig.main)
      rawManifest.main = rawManifest.publishConfig.main;

    if (rawManifest.publishConfig.module) {
      rawManifest.module = rawManifest.publishConfig.module;
    }
  }
}
