import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                          from '@yarnpkg/pnp';
import CJSON                             from 'comment-json';
import mergeWith                         from 'lodash/mergeWith';

export const merge = (object: unknown, source: unknown) =>
  mergeWith(object, source, (objValue, srcValue) => {
    if (Array.isArray(objValue))
      return [...new Set(objValue.concat(srcValue))];

    return undefined;
  });

export const addSettingWorkspaceConfiguration = async (pnpApi: PnpApi, relativeFileName: PortablePath, patch: any) => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const filePath = ppath.join(projectRoot, relativeFileName);

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

