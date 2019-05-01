import {FakeFS, NodeFS}                                   from '@berry/fslib';
import {Resolution, parseResolution, stringifyResolution} from '@berry/parsers';
import {posix}                                            from 'path';
import semver                                             from 'semver';

import * as miscUtils                                     from './miscUtils';
import * as structUtils                                   from './structUtils';
import {IdentHash}                                        from './types';
import {Ident, Descriptor}                                from './types';

export interface WorkspaceDefinition {
  pattern: string;
};

export interface DependencyMeta {
  built?: boolean;
  unplugged?: boolean;
};

export interface PeerDependencyMeta {
  optional?: boolean;
};

export class Manifest {
  public name: Ident | null = null;
  public version: string | null = null;

  public ["private"]: boolean = false;
  public license: string | null = null;

  public languageName: string | null = null;

  public bin: Map<string, string> = new Map();
  public scripts: Map<string, string> = new Map();

  public dependencies: Map<IdentHash, Descriptor> = new Map();
  public devDependencies: Map<IdentHash, Descriptor> = new Map();
  public peerDependencies: Map<IdentHash, Descriptor> = new Map();

  public workspaceDefinitions: Array<WorkspaceDefinition> = [];

  public dependenciesMeta: Map<string, Map<string | null, DependencyMeta>> = new Map();
  public peerDependenciesMeta: Map<string, PeerDependencyMeta> = new Map();

  public resolutions: Array<{pattern: Resolution, reference: string}> = [];

  public files: Set<String> | null = null;

  public raw: object | null = null;

  static async find(path: string, {baseFs = new NodeFS()}: {baseFs?: FakeFS} = {}) {
    return await Manifest.fromFile(posix.join(path, `package.json`), {baseFs});
  }

  static async fromFile(path: string, {baseFs = new NodeFS()}: {baseFs?: FakeFS} = {}) {
    const manifest = new Manifest();
    await manifest.loadFile(path, {baseFs});

    return manifest;
  }

  async loadFile(path: string, {baseFs = new NodeFS()}: {baseFs?: FakeFS}) {
    const content = await baseFs.readFilePromise(path, `utf8`);

    let data;
    try {
      data = JSON.parse(content || `{}`);
    } catch (error) {
      error.message += ` (when parsing ${path})`;
      throw error;
    }

    this.load(data);
  }

  load(data: any) {
    if (typeof data !== `object` || data === null)
      throw new Error(`Utterly invalid manifest data (${data})`);

    this.raw = data;
    const errors: Array<Error> = [];

    if (typeof data.name === `string`) {
      try {
        this.name = structUtils.parseIdent(data.name);
      } catch (error) {
        errors.push(new Error(`Parsing failed for the 'name' field`));
      }
    }

    if (typeof data.version === `string`)
      this.version = data.version;

    if (typeof data.private === `boolean`)
      this.private = data.private;

    if (typeof data.license === `string`)
      this.license = data.license;

    if (typeof data.languageName === `string`)
      this.languageName = data.languageName;

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
        this.dependencies.set(descriptor.identHash, descriptor);
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
        this.devDependencies.set(descriptor.identHash, descriptor);
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
        this.peerDependencies.set(descriptor.identHash, descriptor);
      }
    }

    const workspaces = Array.isArray(data.workspaces)
      ? data.workspaces
      : typeof data.workspaces === `object` && data.workspaces !== null && Array.isArray(data.workspaces.packages)
        ? data.workspaces.packages
        : [];

    for (const entry of workspaces) {
      if (typeof entry !== `string`) {
        errors.push(new Error(`Invalid workspace definition for '${entry}'`));
        continue;
      }

      this.workspaceDefinitions.push({
        pattern: entry,
      });
    }

    if (typeof data.dependenciesMeta === `object` && data.dependenciesMeta !== null) {
      for (const [pattern, meta] of Object.entries(data.dependenciesMeta)) {
        if (typeof meta !== `object` || meta === null) {
          errors.push(new Error(`Invalid meta field for '${pattern}`));
          continue;
        }

        const descriptor = structUtils.parseDescriptor(pattern);
        const dependencyMeta = this.ensureDependencyMeta(descriptor);

        Object.assign(dependencyMeta, meta);
      }
    }

    if (typeof data.peerDependenciesMeta === `object` && data.peerDependenciesMeta !== null) {
      for (const [pattern, meta] of Object.entries(data.peerDependenciesMeta)) {
        if (typeof meta !== `object` || meta === null) {
          errors.push(new Error(`Invalid meta field for '${pattern}`));
          continue;
        }

        const descriptor = structUtils.parseDescriptor(pattern);
        const peerDependencyMeta = this.ensurePeerDependencyMeta(descriptor);

        Object.assign(peerDependencyMeta, meta);
      }
    }

    if (typeof data.resolutions === `object` && data.resolutions !== null) {
      for (const [pattern, reference] of Object.entries(data.resolutions)) {
        if (typeof reference !== `string`) {
          errors.push(new Error(`Invalid resolution entry for '${pattern}'`));
          continue;
        }

        try {
          this.resolutions.push({pattern: parseResolution(pattern), reference});
        } catch (error) {
          errors.push(error);
          continue;
        } 
      }
    }

    if (Array.isArray(data.files) && data.files.length !== 0) {
      this.files = new Set();

      for (const filename of data.files) {
        if (typeof filename !== `string`) {
          errors.push(new Error(`Invalid files entry for '${filename}'`));
          continue;
        }

        this.files.add(filename);
      }
    }

    return errors;
  }

  getForScope(type: string) {
    switch (type) {
      case `dependencies`:
        return this.dependencies;

      case `devDependencies`:
        return this.devDependencies;

      case `peerDependencies`:
        return this.peerDependencies;

      default: {
        throw new Error(`Unsupported value ("${type}")`);
      }
    }
  }

  ensureDependencyMeta(descriptor: Descriptor) {
    if (descriptor.range !== `unknown` && !semver.valid(descriptor.range))
      throw new Error(`Invalid meta field range for '${structUtils.stringifyDescriptor(descriptor)}'`);

    const identString = structUtils.stringifyIdent(descriptor);
    const range = descriptor.range !== `unknown` ? descriptor.range : null;

    let dependencyMetaSet = this.dependenciesMeta.get(identString);
    if (!dependencyMetaSet)
      this.dependenciesMeta.set(identString, dependencyMetaSet = new Map());

    let dependencyMeta = dependencyMetaSet.get(range);
    if (!dependencyMeta)
      dependencyMetaSet.set(range, dependencyMeta = {});

    return dependencyMeta;
  }

  ensurePeerDependencyMeta(descriptor: Descriptor) {
    if (descriptor.range !== `unknown`)
      throw new Error(`Invalid meta field range for '${structUtils.stringifyDescriptor(descriptor)}'`);

    const identString = structUtils.stringifyIdent(descriptor);

    let peerDependencyMeta = this.peerDependenciesMeta.get(identString);
    if (!peerDependencyMeta)
      this.peerDependenciesMeta.set(identString, peerDependencyMeta = {});

    return peerDependencyMeta;
  }

  exportTo(data: {[key: string]: any}) {
    if (this.name !== null)
      data.name = structUtils.stringifyIdent(this.name);
    else
      delete data.name;

    if (this.version !== null)
      data.version = this.version;
    else
      delete data.version;

    if (this.private)
      data.private = true;
    else
      delete data.private;

    if (this.license !== null)
      data.license = this.license;
    else
      delete data.license;

    if (this.languageName !== null)
      data.languageName = this.languageName;
    else
      delete data.languageName;

    data.dependencies = this.dependencies.size === 0 ? undefined : Object.assign({}, ... structUtils.sortDescriptors(this.dependencies.values()).map(dependency => {
      return {[structUtils.stringifyIdent(dependency)]: dependency.range};
    }));

    data.devDependencies = this.devDependencies.size === 0 ? undefined : Object.assign({}, ... structUtils.sortDescriptors(this.devDependencies.values()).map(dependency => {
      return {[structUtils.stringifyIdent(dependency)]: dependency.range};
    }));

    data.peerDependencies = this.peerDependencies.size === 0 ? undefined : Object.assign({}, ... structUtils.sortDescriptors(this.peerDependencies.values()).map(dependency => {
      return {[structUtils.stringifyIdent(dependency)]: dependency.range};
    }));

    data.dependenciesMeta = {};

    for (const [identString, dependencyMetaSet] of miscUtils.sortMap(this.dependenciesMeta.entries(), ([identString, dependencyMetaSet]) => identString)) {
      for (const [range, meta] of miscUtils.sortMap(dependencyMetaSet.entries(), ([range, meta]) => range !== null ? `0${range}` : `1`)) {
        const key = range !== null
          ? structUtils.stringifyDescriptor(structUtils.makeDescriptor(structUtils.parseIdent(identString), range))
          : identString;

        data.dependenciesMeta[key] = meta;
      }
    }

    if (Object.keys(data.dependenciesMeta).length === 0)
      data.dependenciesMeta = undefined;

    data.peerDependenciesMeta = this.peerDependenciesMeta.size === 0 ? undefined : Object.assign({}, ... miscUtils.sortMap(this.peerDependenciesMeta.entries(), ([identString, meta]) => identString).map(([identString, meta]) => {
      return {[identString]: meta};
    }));

    data.resolutions = this.resolutions.length === 0 ? undefined : Object.assign({}, ... this.resolutions.map(({pattern, reference}) => {
      return {[stringifyResolution(pattern)]: reference};
    }));

    if(this.files === null) {
      data.files = undefined;
    } else {
      data.files = Array.from(this.files);
    }
  }
};
