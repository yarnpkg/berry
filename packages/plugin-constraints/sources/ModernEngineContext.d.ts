export type PartialObject = {[key: string]: PartialObject} | string | number | null;

export type Dependency = {
  workspace: Workspace;
  ident: string;
  range: string;
  type: string;
  update(range: string | undefined): void;
  delete(): void;
  error(message: string): void;
};

export type Workspace = {
  cwd: string;
  ident: string | null;
  manifest: PartialObject;
  set(path: Array<string> | string, value: any): void;
  unset(path: Array<string> | string): void;
};

export type WorkspaceFilter = {
  cwd?: string;
  ident?: string;
};

export type DependencyFilter = {
  ident?: string;
};

export type Yarn = {
  workspace(filter?: WorkspaceFilter): Workspace | null;
  workspaces(filter?: WorkspaceFilter): Array<Workspace>;
  dependencies(filter?: DependencyFilter): Array<Dependency>;
};

export type Context = {
  Yarn: Yarn;
};
