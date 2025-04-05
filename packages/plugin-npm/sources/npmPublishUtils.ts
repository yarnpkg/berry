import {execUtils, Ident}         from '@yarnpkg/core';
import {Workspace, structUtils}   from '@yarnpkg/core';
import {PortablePath, xfs, npath} from '@yarnpkg/fslib';
import {packUtils}                from '@yarnpkg/plugin-pack';
import ssri, {type Integrity}     from 'ssri';

import {normalizeRegistry}        from './npmConfigUtils';
import {generateProvenance}       from './npmProvenance';

type PublishAdditionalParams = {
  access: string | undefined;
  tag: string;
  registry: string;
  gitHead?: string;
  provenance?: boolean;
};

export async function makePublishBody(workspace: Workspace, buffer: Buffer, {access, tag, registry, gitHead, provenance}: PublishAdditionalParams) {
  const ident = workspace.manifest.name!;
  const version = workspace.manifest.version!;

  const name = structUtils.stringifyIdent(ident);

  const integrity = ssri.fromData(buffer, {
    algorithms: [`sha1`, `sha512`],
  }) as unknown as Record<`sha1` | `sha512`, Array<Integrity>>;

  const publishAccess = access ?? getPublishAccess(workspace, ident);
  const readmeContent = await getReadmeContent(workspace);

  const raw = await packUtils.genPackageManifest(workspace);

  // This matches Lerna's logic:
  // https://github.com/evocateur/libnpmpublish/blob/latest/publish.js#L142
  // While the npm registry ignores the provided tarball URL, it's used by
  // other registries such as verdaccio.
  const tarballName = `${name}-${version}.tgz`;
  const tarballURL = new URL(`${normalizeRegistry(registry)}/${name}/-/${tarballName}`);

  const _attachments = {
    [tarballName]: {
      [`content_type`]: `application/octet-stream`,
      data: buffer.toString(`base64`),
      length: buffer.length,
    },
  };

  // Adapted from https://github.com/npm/cli/blob/04f53ce13201b460123067d7153f1681342548e1/workspaces/libnpmpublish/lib/publish.js#L138
  if (provenance) {
    const subject = {
      // Adapted from https://github.com/npm/npm-package-arg/blob/fbbf22ef99ece449428fee761ae8950c08bc2cbf/lib/npa.js#L118
      name: `pkg:npm/${name.replace(/^@/, `%40`)}@${version}`,
      digest: {sha512: integrity.sha512[0].hexDigest()},
    };
    const provenanceBundle = await generateProvenance([subject]);
    const serializedBundle = JSON.stringify(provenanceBundle);
    _attachments[`${name}-${version}.sigstore`] = {
      content_type: provenanceBundle.mediaType,
      data: serializedBundle,
      length: serializedBundle.length,
    };
  }

  return {
    _id: name,
    _attachments,
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
          shasum: integrity.sha1[0].hexDigest(),
          integrity: integrity.sha512[0].toString(),

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
