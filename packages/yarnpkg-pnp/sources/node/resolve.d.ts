export type PackageImportsResolveOptions = {
  name: string;
  base: URL | string;
  conditions: Set<string>;
  readFileSyncFn: (path: string) => string | undefined;
};

export function packageImportsResolve(
  opts: PackageImportsResolveOptions
): URL | string;
