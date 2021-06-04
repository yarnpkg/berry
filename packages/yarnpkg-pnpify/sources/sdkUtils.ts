import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {PnpApi}                          from '@yarnpkg/pnp';
import CJSON                             from 'comment-json';
import mergeWith                         from 'lodash/mergeWith';

export const merge = (cjsonData: unknown, patch: unknown) =>
  mergeWith(cjsonData, patch, (cjsonValue: unknown, patchValue: unknown) => {
    // We need to preserve comments in CommentArrays, so we can't use spread or Sets
    if (Array.isArray(cjsonValue) && Array.isArray(patchValue)) {
      for (const patchItem of patchValue) {
        if (!cjsonValue.includes(patchItem)) {
          cjsonValue.push(patchItem);
        }
      }

      return cjsonValue;
    }

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

  await xfs.mkdirPromise(ppath.dirname(filePath), {recursive: true});
  await xfs.changeFilePromise(filePath, patched, {
    automaticNewlines: true,
  });
};
