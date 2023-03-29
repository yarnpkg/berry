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
  manifest: PartialObject;

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
   * Only return dependencies with the given name.
   */
  ident?: string;
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
   * Select all dependencies according to the provided filter.
   *
   * @param filter
   */
  dependencies(filter?: DependencyFilter): Array<Dependency>;
};

export type Context = {
  Yarn: Yarn;
};
