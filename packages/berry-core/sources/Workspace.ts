import globby = require('globby');

import {createHmac}            from 'crypto';
import {existsSync, readFile}  from 'fs';
import {resolve}               from 'path';
import {promisify}             from 'util';

import {Manifest}              from './Manifest';
import {Project}               from './Project';
import {WorkspaceBaseResolver} from './WorkspaceBaseResolver';
import * as structUtils        from './structUtils';
import {Descriptor, Locator}   from './types';

const readFileP = promisify(readFile);

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

  // Generated at resolution; basically dependencies + devDependencies
  public dependencies: Map<string, Descriptor> = new Map();

  constructor(workspaceCwd: string, {project}: {project: Project}) {
    this.project = project;
    this.cwd = workspaceCwd;
  }

  async setup() {
    const source = await readFileP(`${this.cwd}/package.json`, `utf8`);
    const data = JSON.parse(source);

    // @ts-ignore: It's ok to initialize it now
    this.manifest = new Manifest();
    this.manifest.load(data);

    const ident = this.manifest.name ? this.manifest.name : structUtils.makeIdent(null, `unnamed-workspace-${hashWorkspaceCwd(this.cwd)}`);
    const reference = this.manifest.version ? this.manifest.version : `0.0.0`;

    // @ts-ignore: It's ok to initialize it now
    this.locator = structUtils.makeLocatorFromIdent(ident, reference);
  }

  async resolveChildWorkspaces() {
    const workspaceCwds = [];

    for (const definition of this.manifest.workspaceDefinitions) {
      const relativeCwds = await globby(definition.pattern, {
        cwd: this.cwd,
        onlyDirectories: true,
      });

      // It seems that the return value of globby isn't in any guaranteed order - not even the directory listing order
      relativeCwds.sort();

      for (const relativeCwd of relativeCwds) {
        const candidateCwd = resolve(this.cwd, relativeCwd);

        if (existsSync(`${candidateCwd}/package.json`)) {
          workspaceCwds.push(candidateCwd);
        }
      }
    }

    return workspaceCwds;
  }

  accepts(range: string) {
    return true;
  }

  get anchoredDescriptor() {
    return structUtils.makeDescriptor(this.locator, `${WorkspaceBaseResolver.protocol}${this.locator.reference}`);
  }

  get anchoredLocator() {
    return structUtils.makeLocatorFromIdent(this.locator, `${WorkspaceBaseResolver.protocol}${this.locator.reference}`);
  }
}
