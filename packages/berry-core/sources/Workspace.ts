import {xfs}                   from '@berry/fslib';
import {makeUpdater}           from '@berry/json-proxy';
import {createHmac}            from 'crypto';
import globby                  from 'globby';
import {posix}                 from 'path';
import semver                  from 'semver';

import {Manifest}              from './Manifest';
import {Project}               from './Project';
import {WorkspaceResolver}     from './WorkspaceResolver';
import * as structUtils        from './structUtils';
import {IdentHash}             from './types';
import {Descriptor, Locator}   from './types';

function hashWorkspaceCwd(cwd: string) {
  return createHmac('sha256', 'berry').update(cwd).digest('hex').substr(0, 6);
}

export class Workspace {
  public readonly project: Project;
  public readonly cwd: string;

  // @ts-ignore: This variable is set during the setup process
  public readonly locator: Locator;

  // @ts-ignore: This variable is set during the setup process
  public readonly manifest: Manifest;

  // @ts-ignore: This variable is set during the setup process
  public readonly workspacesCwds: Set<string> = new Set();

  // Generated at resolution; basically dependencies + devDependencies + child workspaces
  public dependencies: Map<IdentHash, Descriptor> = new Map();

  constructor(workspaceCwd: string, {project}: {project: Project}) {
    this.project = project;
    this.cwd = workspaceCwd;
  }

  async setup() {
    // @ts-ignore: It's ok to initialize it now
    this.manifest = await Manifest.find(this.cwd);

    // We use posix.relative to guarantee that the default hash will be consistent even if the project is installed on different OS / path
    const relativePath = posix.relative(this.project.cwd, this.cwd);

    const ident = this.manifest.name ? this.manifest.name : structUtils.makeIdent(null, `${this.computeCandidateName()}-${hashWorkspaceCwd(relativePath)}`);
    const reference = this.manifest.version ? this.manifest.version : `0.0.0`;

    // @ts-ignore: It's ok to initialize it now, even if it's readonly (setup is called right after construction)
    this.locator = structUtils.makeLocator(ident, reference);

    for (const definition of this.manifest.workspaceDefinitions) {
      const relativeCwds = await globby(definition.pattern, {
        absolute: true,
        cwd: this.cwd,
        expandDirectories: false,
        onlyDirectories: true,
        onlyFiles: false,
      });

      // It seems that the return value of globby isn't in any guaranteed order - not even the directory listing order
      relativeCwds.sort();

      for (const relativeCwd of relativeCwds) {
        const candidateCwd = posix.resolve(this.cwd, relativeCwd);

        if (xfs.existsSync(`${candidateCwd}/package.json`)) {
          this.workspacesCwds.add(candidateCwd);
        }
      }
    }
  }

  accepts(range: string) {
    const protocolIndex = range.indexOf(`:`);

    const protocol = protocolIndex !== -1
      ? range.slice(0, protocolIndex + 1)
      : null;

    const pathname = protocolIndex !== -1
      ? range.slice(protocolIndex + 1)
      : range;

    if (protocol === WorkspaceResolver.protocol && pathname === this.relativeCwd)
      return true;
    
    if (!semver.validRange(pathname))
      return false;

    if (protocol === WorkspaceResolver.protocol)
      return semver.satisfies(this.manifest.version !== null ? this.manifest.version : `0.0.0`, pathname);
    
    if (this.manifest.version !== null)
      return semver.satisfies(this.manifest.version, pathname);

    return false;
  }

  get relativeCwd() {
    return posix.relative(this.project.cwd, this.cwd) || `.`;
  }

  get anchoredDescriptor() {
    return structUtils.makeDescriptor(this.locator, `${WorkspaceResolver.protocol}${this.relativeCwd}`);
  }

  get anchoredLocator() {
    return structUtils.makeLocator(this.locator, `${WorkspaceResolver.protocol}${this.relativeCwd}`);
  }

  computeCandidateName() {
    if (this.cwd === this.project.cwd) {
      return `root-workspace`;
    } else {
      return `${posix.basename(this.cwd)}` || `unnamed-workspace`;
    }
  }

  async persistManifest() {
    const updater = await makeUpdater(`${this.cwd}/package.json`);

    updater.open((tracker: Object) => {
      this.manifest.exportTo(tracker);
    });

    await updater.save();
  }
}
