import {execUtils, Ident}         from '@yarnpkg/core';
import {Workspace, structUtils}   from '@yarnpkg/core';
import {PortablePath, xfs, npath} from '@yarnpkg/fslib';
import {packUtils}                from '@yarnpkg/plugin-pack';
import {createHash}               from 'crypto';
import ssri                       from 'ssri';

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

  const publishAccess = access ?? getPublishAccess(workspace, ident);
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

export function getPublishAccess(workspace: Workspace, ident: Ident): string {
  const configuration = workspace.project.configuration;

  if (workspace.manifest.publishConfig && typeof workspace.manifest.publishConfig.access === `string`)
    return workspace.manifest.publishConfig.access;

  if (configuration.get(`npmPublishAccess`) !== null)
    return configuration.get(`npmPublishAccess`)!;

  const access = ident.scope
    ? `restricted`
    : `public`;

  return access;
}

export async function getReadmeContent(workspace: Workspace): Promise<string>  {
  const readmePath = npath.toPortablePath(`${workspace.cwd}/README.md`);

  const ident = workspace.manifest.name!;
  const packageName = structUtils.stringifyIdent(ident);

  let readme = `# ${packageName}\n`;
  try {
    readme = await xfs.readFilePromise(readmePath, `utf8`);
  } catch (err) {
    if (err.code === `ENOENT`) {
      return readme;
    } else {
      throw err;
    }
  }

  return readme;
}
