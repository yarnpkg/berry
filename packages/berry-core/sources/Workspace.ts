import globby = require('globby');

import {createHmac}                 from 'crypto';
import {existsSync, readFile}       from 'fs';
import {resolve}                    from 'path';
import {promisify}                  from 'util';

import {Project}                    from './Project';
import * as structUtils             from './structUtils';
import {Ident, Descriptor, Locator} from './types';

const readFileP = promisify(readFile);

export interface WorkspaceDefinition {
  pattern: string;
};

function hashWorkspaceCwd(cwd: string) {
  return createHmac('sha256', 'berry').update(cwd).digest('hex').substr(0, 6);
}

export class Workspace {
  public readonly project: Project;
  public readonly cwd: string;

  // @ts-ignore: This variable is set during the setup process
  public locator: Locator;

  public dependencies: Map<string, Descriptor> = new Map();
  public devDependencies: Map<string, Descriptor> = new Map();
  public peerDependencies: Map<string, Descriptor> = new Map();

  public workspaceDefinitions: Array<WorkspaceDefinition> = [];

  constructor(workspaceCwd: string, {project}: {project: Project}) {
    this.project = project;
    this.cwd = workspaceCwd;
  }

  async setup() {
    const content = await readFileP(`${this.cwd}/package.json`, `utf8`);
    const data = JSON.parse(content);

    const ident = data.name ? structUtils.parseIdent(data.name) : structUtils.makeIdent(null, `unnamed-workspace-${hashWorkspaceCwd(this.cwd)}`);
    const reference = data.version ? data.version : `0.0.0`;

    this.locator = structUtils.makeLocatorFromIdent(ident, reference);

    if (data.dependencies) {
      for (const [name, range] of Object.entries(data.dependencies || {})) {
        if (typeof range !== 'string')
          throw new Error(`Invalid dependency range for '${name}', in '${this.cwd}'`);

        const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(name), range);
        this.addDependency(descriptor);
      }
    }

    if (data.devDependencies) {
      for (const [name, range] of Object.entries(data.devDependencies || {})) {
        if (typeof range !== 'string')
          throw new Error(`Invalid dependency range for '${name}', in '${this.cwd}'`);

        const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(name), range);
        this.addDevDependency(descriptor);
      }
    }

    if (data.peerDependencies) {
      for (const [name, range] of Object.entries(data.peerDependencies || {})) {
        if (typeof range !== 'string')
          throw new Error(`Invalid dependency range for '${name}', in '${this.cwd}'`);

        const descriptor = structUtils.makeDescriptor(structUtils.parseIdent(name), range);
        this.addPeerDependency(descriptor);
      }
    }

    if (data.workspaces) {
      for (const entry of data.workspaces) {
        this.workspaceDefinitions.push({
          pattern: entry,
        });
      }
    }
  }

  async resolveChildWorkspaces() {
    const workspaceCwds = [];

    for (const definition of this.workspaceDefinitions) {
      const relativeCwds = await globby(definition.pattern, {
        cwd: this.cwd,
        onlyDirectories: true,
      });

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

  addDependency(descriptor: Descriptor) {
    this.dependencies.set(descriptor.identHash, descriptor);
  }

  removeDependency(ident: Ident) {
    this.dependencies.delete(ident.identHash);
  }

  addDevDependency(descriptor: Descriptor) {
    this.devDependencies.set(descriptor.identHash, descriptor);
  }

  removeDevDependency(ident: Ident) {
    this.devDependencies.delete(ident.identHash);
  }

  addPeerDependency(descriptor: Descriptor) {
    this.peerDependencies.set(descriptor.identHash, descriptor);
  }

  removePeerDependency(ident: Ident) {
    this.peerDependencies.delete(ident.identHash);
  }
}
