import {execUtils, Ident}         from '@yarnpkg/core';
import {Workspace, structUtils}   from '@yarnpkg/core';
import {PortablePath, xfs, npath} from '@yarnpkg/fslib';
import {packUtils}                from '@yarnpkg/plugin-pack';
import {createHash}               from 'crypto';
import ssri                       from 'ssri';
import {URL}                      from 'url';

import {normalizeRegistry}        from './npmConfigUtils';

type PublishAdditionalParams = {
  access: string | undefined;
  tag: string;
  registry: string;
  gitHead?: string;
};
export async function makePublishBody(workspace: Workspace, buffer: Buffer, {access, tag, registry, gitHead}: PublishAdditionalParams) {
  const ident = workspace.manifest.name!;
  const version = workspace.manifest.version!;

  const name = structUtils.stringifyIdent(ident);

  const shasum = createHash(`sha1`).update(buffer).digest(`hex`);
  const integrity = ssri.fromData(buffer).toString();

  const publishAccess = getPublishAccess(workspace, ident, access);
  const readmeContent = await getReadmeContent(workspace);

  const raw = await packUtils.genPackageManifest(workspace);

  // This matches Lerna's logic:
  // https://github.com/evocateur/libnpmpublish/blob/latest/publish.js#L142
  // While the npm registry ignores the provided tarball URL, it's used by
  // other registries such as verdaccio.
  const tarballName = `${name}-${version}.tgz`;
  const tarballURL = new URL(`${normalizeRegistry(registry)}/${name}/-/${tarballName}`);

  return {
    _id: name,
    _attachments: {
      [tarballName]: {
        [`content_type`]: `application/octet-stream`,
        data: buffer.toString(`base64`),
        length: buffer.length,
      },
    },
    name,
    access: publishAccess,

    [`dist-tags`]: {
      [tag]: version,
    },

    versions: {
      [version]: {
        ...raw,

        _id: `${name}@${version}`,

        name,
        version,
        gitHead,

        dist: {
          shasum,
          integrity,

          // the npm registry requires a tarball path, but it seems useless 🤷
          tarball: tarballURL.toString(),
        },
      },
    },
    readme: readmeContent,
  };
}

export async function getGitHead(workingDir: PortablePath) {
  try {
    const {stdout} = await execUtils.execvp(`git`, [`rev-parse`, `--revs-only`, `HEAD`], {cwd: workingDir});
    if (stdout.trim() === ``)
      return undefined;
    return stdout.trim();
  } catch {
    return undefined;
  }
}

export async function getPublishAccess(workspace: Workspace, ident: Ident, access?: string) {
  const configuration = workspace.project.configuration;

  if (typeof access === `undefined`) {
    if (workspace.manifest.publishConfig && typeof workspace.manifest.publishConfig.access === `string`) {
      access = workspace.manifest.publishConfig.access;
    } else if (configuration.get(`npmPublishAccess`) !== null) {
      access = configuration.get(`npmPublishAccess`)!;
    } else if (ident.scope) {
      access = `restricted`;
    } else {
      access = `public`;
    }
  }
}
export async function getReadmeContent(workspace: Workspace): Promise<string>  {
  const currentDir = npath.toPortablePath(`${workspace.cwd}/README.md`);
  const readmeContent = await xfs.readFilePromise(currentDir, `utf-8`);
  return readmeContent;
}
