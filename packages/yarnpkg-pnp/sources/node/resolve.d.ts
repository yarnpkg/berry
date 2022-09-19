export type PackageImportsResolveOptions = {
  name: string;
  base: URL | string;
  conditions: Set<string>;
  readFileSyncFn: (path: string) => string | undefined;
};

export function packageImportsResolve(
  opts: PackageImportsResolveOptions
): URL | string;

export type PackageExportsResolveOptions = {
  packageJSONUrl: URL;
  packageSubpath: string;
  exports: string | Record<string, any>;
  base: URL | null;
  conditions: Set<string>;
};

export function packageExportsResolve(opts: PackageExportsResolveOptions): URL;
