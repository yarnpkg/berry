import {PortablePath, npath, ppath, xfs}                      from '@yarnpkg/fslib';
import {PnpApi}                                               from '@yarnpkg/pnp';
import CJSON                                                  from 'comment-json';
import mergeWith                                              from 'lodash/mergeWith';

import {Wrapper, GenerateIntegrationWrapper, IntegrationSdks} from '../generateSdk';

export const merge = (object: unknown, source: unknown) =>
  mergeWith(object, source, (objValue, srcValue) => {
    if (Array.isArray(objValue))
      return [...new Set(objValue.concat(srcValue))];

    return undefined;
  });

export enum CocVimConfiguration {
  settings = `coc-settings.json`,
}

export const addVSCodeWorkspaceConfiguration = async (pnpApi: PnpApi, type: CocVimConfiguration, patch: any) => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const filePath = ppath.join(projectRoot, `.vim` as PortablePath, type as PortablePath);

  const content = await xfs.existsPromise(filePath)
    ? await xfs.readFilePromise(filePath, `utf8`)
    : `{}`;

  const data = CJSON.parse(content);
  const patched = `${CJSON.stringify(merge(data, patch), null, 2)}\n`;

  await xfs.mkdirpPromise(ppath.dirname(filePath));
  await xfs.changeFilePromise(filePath, patched, {
    automaticNewlines: true,
  });
};

export const generateEslintWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`eslint.packageManager`]: `yarn`,
    [`eslint.nodePath`]: npath.fromPortablePath(
      ppath.dirname(ppath.dirname(ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/api.js` as PortablePath,
        ),
      ))),
    ),
  });
};

export const generateTypescriptWrapper: GenerateIntegrationWrapper = async (pnpApi: PnpApi, target: PortablePath, wrapper: Wrapper) => {
  await addVSCodeWorkspaceConfiguration(pnpApi, CocVimConfiguration.settings, {
    [`tsserver.tsdk`]: npath.fromPortablePath(
      ppath.dirname(
        wrapper.getProjectPathTo(
          `lib/tsserver.js` as PortablePath,
        ),
      ),
    ),
  });
};

export const COC_VIM_SDKS: IntegrationSdks = [
  [`eslint`, generateEslintWrapper],
  [`typescript`, generateTypescriptWrapper],
];
