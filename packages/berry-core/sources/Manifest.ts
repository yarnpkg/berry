import * as structUtils    from './structUtils';
import {Ident, Descriptor} from './types';

export interface WorkspaceDefinition {
  pattern: string;
};

export class Manifest {
  public name: Ident | null = null;
  public version: string | null = null;

  public bin: Map<string, string> = new Map();
  public scripts: Map<string, string> = new Map();

  public dependencies: Map<string, Descriptor> = new Map();
  public devDependencies: Map<string, Descriptor> = new Map();
  public peerDependencies: Map<string, Descriptor> = new Map();

  public workspaceDefinitions: Array<WorkspaceDefinition> = [];

  load(data: any) {
    if (typeof data !== `object` || data === null)
      throw new Error(`Utterly invalid manifest data`);

    const errors: Array<Error> = [];

    if (typeof data.name === `string`) {
      try {
        this.name = structUtils.parseIdent(data.name);
      } catch (error) {
        errors.push(new Error(`Parsing failed for the 'name' field`));
      }
    }

    if (typeof data.bin === `string`) {
      if (this.name !== null) {
        this.bin = new Map([[structUtils.stringifyIdent(this.name), data.bin]]);
      } else {
        errors.push(new Error(`String bin field, but no attached package name`));
      }
    } else if (typeof data.bin === `object` && data.bin !== null) {
      for (const [key, value] of Object.entries(data.bin)) {
        if (typeof value !== `string`) {
          errors.push(new Error(`Invalid bin definition for '${key}'`));
          continue;
        }

        this.bin.set(key, value);
      }
    }

    if (typeof data.scripts === `object` && data.scripts !== null) {
      for (const [key, value] of Object.entries(data.scripts)) {
        if (typeof value !== `string`) {
          errors.push(new Error(`Invalid script definition for '${key}'`));
          continue;
        }

        this.scripts.set(key, value);
      }
    }

    if (typeof data.dependencies === `object` && data.dependencies !== null) {
      for (const [name, range] of Object.entries(data.dependencies)) {
        if (typeof range !== 'string') {
          errors.push(new Error(`Invalid dependency range for '${name}'`));
          continue;
        }

        let ident;
        try {
          ident = structUtils.parseIdent(name);
        } catch (error) {
          errors.push(new Error(`Parsing failed for the dependency name '${name}'`));
          continue;
        }

        const descriptor = structUtils.makeDescriptor(ident, range);
        this.dependencies.set(descriptor.descriptorHash, descriptor);
      }
    }

    if (typeof data.devDependencies === `object` && data.devDependencies !== null) {
      for (const [name, range] of Object.entries(data.devDependencies)) {
        if (typeof range !== 'string') {
          errors.push(new Error(`Invalid dependency range for '${name}'`));
          continue;
        }

        let ident;
        try {
          ident = structUtils.parseIdent(name);
        } catch (error) {
          errors.push(new Error(`Parsing failed for the dependency name '${name}'`));
          continue;
        }

        const descriptor = structUtils.makeDescriptor(ident, range);
        this.devDependencies.set(descriptor.descriptorHash, descriptor);
      }
    }

    if (typeof data.peerDependencies === `object` && data.peerDependencies !== null) {
      for (const [name, range] of Object.entries(data.peerDependencies)) {
        if (typeof range !== 'string') {
          errors.push(new Error(`Invalid dependency range for '${name}'`));
          continue;
        }

        let ident;
        try {
          ident = structUtils.parseIdent(name);
        } catch (error) {
          errors.push(new Error(`Parsing failed for the dependency name '${name}'`));
          continue;
        }

        const descriptor = structUtils.makeDescriptor(ident, range);
        this.peerDependencies.set(descriptor.descriptorHash, descriptor);
      }
    }

    if (Array.isArray(data.workspaces)) {
      for (const entry of data.workspaces) {
        if (typeof entry !== `string`) {
          errors.push(new Error(`Invalid workspace definition for '${entry}'`));
          continue;
        }

        this.workspaceDefinitions.push({
          pattern: entry,
        });
      }
    }

    return errors;
  }
};
