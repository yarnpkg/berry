export const dynamicLibs = new Set([
  `@yarnpkg/cli`,
  `@yarnpkg/core`,
  `@yarnpkg/fslib`,
  `@yarnpkg/libzip`,
  `@yarnpkg/parsers`,
  `@yarnpkg/shell`,

  // Those ones are always useful
  `clipanion`,
  `semver`,
  `yup`,
]);

export const isDynamicLib = (request: string) => {
  if (dynamicLibs.has(request))
    return true;

  if (request.match(/^@yarnpkg\/plugin-/))
    return true;

  return false;
};
