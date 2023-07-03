export type PartialObject = {[key: string]: PartialObject} | string | number | null;

export type DependencyType =
  | `dependencies`
  | `devDependencies`
  | `peerDependencies`;

export type Dependency = {
  /**
   * Reference to the owning workspace.
   */
  workspace: Workspace;

  /**
   * Dependency name.
   */
  ident: string;

  /**
   * Dependency range. Note that it doesn't have to be a semver value - it
   * can also be a git repository, and http url, etc.
   */
  range: string;

  /**
   * Name of the field under which this dependency can be found.
   */
  type: DependencyType;

  /**
   * Package currently used to resolve the dependency. May be null if the
   * dependency couldn't be resolved. This can happen in those cases:
   *
   * - The dependency is a peer dependency; workspaces don't have ancestors
   *   to satisfy their peer dependencies, so they're always unresolved. This
   *   is why we recommend to list a dev dependency for each non-optional peer
   *   dependency you list, so that Yarn can fallback to it.
   *
   * - The dependency is a prod dependency, and there's a dev dependency of the
   *   same name (in which case there will be a separate dependency entry for
   *   the dev dependency, which will have the resolution).
   */
  resolution: Package | null;

  /**
   * Report an error unless the dependency has the expected range. If
   * `--fix` is set, Yarn will silently update the package.json instead of
   * reporting an error.
   *
   * @param range New range for the dependency.
   */
  update(range: string | undefined): void;

  /**
   * Report an error (useful when you want to forbid a specific package
   * from being added to the dependencies). If `--fix` is set, Yarn will
   * silently remove the dependency from the package.json instead of
   * reporting an error.
   */
  delete(): void;

  /**
   * Report a non-recoverable custom error.
   *
   * @param message Error message
   */
  error(message: string): void;
};

export type Workspace = {
  /**
   * Relative path from the project root to the workspace. The root
   * workspace always has a `cwd` equal to `.`.
   */
  cwd: string;

  /**
   * Workspace name.
   */
  ident: string | null;

  /**
   * Raw manifest object for the workspace.
   */
  manifest: any;

  /**
   * The resolved information for the workspace.
   */
  pkg: Package;

  /**
   * Report an error unless the workspace lists the specified property
   * with the specified value. If `--fix` is set, Yarn will silently update
   * the package.json instead of reporting an error.
   *
   * @param path Property path
   * @param value Expected value
   */
  set(path: Array<string> | string, value: any): void;

  /**
   * Report an error if the workspace lists the specified property. If
   * `--fix` is set, Yarn will silently remove the field from the
   * package.json instead of reporting an error.
   *
   * @param path Property path
   */
  unset(path: Array<string> | string): void;

  /**
   * Report a non-recoverable custom error.
   *
   * @param message Error message
   */
  error(message: string): void;
};

export type Package = {
  /**
   * If the package is a workspace, return the corresponding workspace
   */
  workspace: Workspace | null;

  /**
   * Package name.
   */
  ident: string;

  /**
   * Package version.
   */
  version: string | null;

  /**
   * A map of the dependencies the package is allowed to access. There's no
   * distinction between prod dependencies and dev dependencies.
   */
  dependencies: Map<string, Package>;

  /**
   * A map of the required peer dependencies declared in the package.
   */
  peerDependencies: Map<string, string>;

  /**
   * A map of the optional peer dependencies declared in the package.
   */
  optionalPeerDependencies: Map<string, string>;
};

export type WorkspaceFilter = {
  /**
   * Only return the workspace with the given relative path.
   *
   * Note: This doesn't currently support glob patterns. Help welcome!
   */
  cwd?: string;

  /**
   * Only return the workspace with the given package name.
   *
   * Note: This doesn't currently support glob patterns. Help welcome!
   */
  ident?: string;
};

export type DependencyFilter = {
  /**
   * Only return dependencies from the given workspace.
   */
  workspace?: Workspace;

  /**
   * Only return dependencies with the given name.
   */
  ident?: string;

  /**
   * Only return dependencies listed in the following set.
   */
  type?: DependencyType;
};

export type PackageFilter = {
  /**
   * Only return packages from the given workspace.
   */
  workspace?: Workspace;

  /**
   * Only return packages with the given name.
   */
  ident?: string;

  /**
   * Only return packages with the given reference.
   */
  reference?: string;
};

export type Yarn = {
  /**
   * Select a unique workspace according to the provided filter.
   *
   * @param filter
   */
  workspace(): Workspace;
  workspace(filter?: WorkspaceFilter): Workspace | null;

  /**
   * Select all matching workspaces according to the provided filter.
   *
   * @param filter
   */
  workspaces(filter?: WorkspaceFilter): Array<Workspace>;

  /**
   * Select a unique workspace according to the provided filter.
   *
   * @param filter
   */
  dependency(filter: DependencyFilter): Dependency | null;

  /**
   * Select all dependencies according to the provided filter.
   *
   * @param filter
   */
  dependencies(filter?: DependencyFilter): Array<Dependency>;

  /**
   * Select a unique workspace according to the provided filter.
   *
   * @param filter
   */
  package(filter: DependencyFilter): Package | null;

  /**
   * Select all dependencies according to the provided filter.
   *
   * @param filter
   */
  packages(filter: DependencyFilter): Array<Package>;
};

export type Context = {
  Yarn: Yarn;
};
