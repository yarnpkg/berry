import {miscUtils}                       from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                          from '@yarnpkg/pnp';
import CJSON                             from 'comment-json';

export const addSettingWorkspaceConfiguration = async (pnpApi: PnpApi, relativeFileName: PortablePath, patch: any) => {
  const topLevelInformation = pnpApi.getPackageInformation(pnpApi.topLevel)!;
  const projectRoot = npath.toPortablePath(topLevelInformation.packageLocation);

  const filePath = ppath.join(projectRoot, relativeFileName);

  const content = await xfs.existsPromise(filePath)
    ? await xfs.readFilePromise(filePath, `utf8`)
    : `{}`;

  const data = CJSON.parse(content);
  const patched = `${CJSON.stringify(miscUtils.mergeIntoTarget(data, patch), null, 2)}\n`;

  await xfs.mkdirPromise(ppath.dirname(filePath), {recursive: true});
  await xfs.changeFilePromise(filePath, patched, {
    automaticNewlines: true,
  });
};
