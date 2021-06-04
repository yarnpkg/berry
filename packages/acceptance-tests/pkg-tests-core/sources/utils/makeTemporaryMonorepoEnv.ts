import {PortablePath, ppath, Filename} from '@yarnpkg/fslib';

import * as fsUtils                    from './fs';
import {RunFunction}                   from './tests';

const deepResolve = require(`super-resolve`);

export const mtme = (
  packageJson: Record<string, any>,
  workspaces: Record<string, Record<string, any>>,
  subDefinition: Record<string, any> | RunFunction,
  fn?: RunFunction | undefined,
) => {
  const createWorkspaces = async (path: PortablePath) => {
    for (const [workspace, manifest] of Object.entries(workspaces)) {
      const workspacePath = ppath.join(path, workspace as PortablePath);
      await fsUtils.mkdirp(workspacePath);

      await fsUtils.writeJson(ppath.join(workspacePath, Filename.manifest), await deepResolve(manifest));
    }
  };

  if (typeof subDefinition === `function`) {
    fn = subDefinition as RunFunction;
    subDefinition = {};
  }

  if (typeof fn !== `function`) {
    throw new Error(
      // eslint-disable-next-line
      `Invalid test function (got ${typeof fn}) - you probably put the closing parenthesis of the "makeTemporaryEnv" utility at the wrong place`,
    );
  }

  return makeTemporaryEnv(packageJson, subDefinition, async args => {
    await createWorkspaces(args.path);

    return fn!(args);
  });
};

(global as any).makeTemporaryMonorepoEnv = mtme;

declare global {
  var makeTemporaryMonorepoEnv: typeof mtme;
}
