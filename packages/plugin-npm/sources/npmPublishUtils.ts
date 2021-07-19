import {Workspace, structUtils}             from '@yarnpkg/core';
import {NodeFS, PortablePath, ppath, npath} from '@yarnpkg/fslib';
import {packUtils}                          from '@yarnpkg/plugin-pack';
import {createHash}                         from 'crypto';
import ssri                                 from 'ssri';
import {URL}                                from 'url';

const nodeFs = new NodeFS();

export async function makePublishBody(workspace: Workspace, buffer: Buffer, {access, tag, registry}: {access: string | undefined, tag: string, registry: string}) {
  const configuration = workspace.project.configuration;

  const ident = workspace.manifest.name!;
  const version = workspace.manifest.version!;

  const name = structUtils.stringifyIdent(ident);

  const shasum = createHash(`sha1`).update(buffer).digest(`hex`);
  const integrity = ssri.fromData(buffer).toString();

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

  const raw = await packUtils.genPackageManifest(workspace);

  // This matches Lerna's logic:
  // https://github.com/evocateur/libnpmpublish/blob/latest/publish.js#L142
  // While the npm registry ignores the provided tarball URL, it's used by
  // other registries such as verdaccio.
  const tarballName = `${name}-${version}.tgz`;
  const tarballURL = new URL(`${name}/-/${tarballName}`, registry);

  return {
    _id: name,
    _attachments: {
      [tarballName]: {
        [`content_type`]: `application/octet-stream`,
        data: buffer.toString(`base64`),
        length: buffer.length,
      },
    },
    gitHead: await gitHead(workspace.cwd),
    name,
    access,

    [`dist-tags`]: {
      [tag]: version,
    },

    versions: {
      [version]: {
        ...raw,

        _id: `${name}@${version}`,

        name,
        version,

        dist: {
          shasum,
          integrity,

          // the npm registry requires a tarball path, but it seems useless 🤷
          tarball: tarballURL.toString(),
        },
      },
    },
  };
}

// This is based on the npm implementation here:
// https://github.com/npm/read-package-json/blob/v3.0.1/read-json.js#L345-L384
async function gitHead (workingDir: PortablePath) {
  try {
    const gitDir = await getGitDir(npath.toPortablePath(workingDir));
    const headFilePath = ppath.resolve(gitDir, `.git/HEAD`);
    const headValue = await nodeFs.readFilePromise(headFilePath, `utf8`);
    if (headValue.match(/^ref: /) == null)
      return headValue.trim();
    const headRefFileName = headValue.replace(/^ref: /, ``).trim();
    const headRefFilePath = ppath.resolve(gitDir, `.git`, headRefFileName);
    const commitRef = await nodeFs.readFilePromise(headRefFilePath, `utf8`).catch(() => null);
    if (commitRef)
      return commitRef.replace(/^ref: /, ``).trim();
    const packFile = ppath.resolve(gitDir, `.git/packed-refs`);
    const refs = await nodeFs.readFilePromise(packFile, `utf8`);
    if (!refs)
      return null;

    const refsList = refs.split(`\n`);
    for (let i = 0; i < refsList.length; i++) {
      const match = refsList[i].match(/^([0-9a-f]{40}) (.+)$/);
      if ((match != null) && match[2].trim() === headRefFileName) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function getGitDir (dir: PortablePath) {
  while (dir != PortablePath.root) {
    try {
      const dirStats = await nodeFs.statPromise(ppath.resolve(dir, `.git`));
      if (dirStats.isDirectory()) {
        return dir;
      }
    } catch {
    }
    dir = ppath.resolve(dir, `..`);
  }
  return dir;
}
