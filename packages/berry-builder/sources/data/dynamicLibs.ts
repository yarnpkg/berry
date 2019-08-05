export const dynamicLibs = new Set([
  `@berry/cli`,
  `@berry/core`,
  `@berry/fslib`,
  `@berry/parsers`,
  `@berry/shell`,

  // Those ones are always useful
  `clipanion`,
  `semver`,
  `yup`,

  // This one register `exit` handlers; it would generate warnings on "foreach" if a plugin happened to use it
  `tmp`,
]);

export const isDynamicLib = (request: string) => {
  if (dynamicLibs.has(request))
    return true;

  if (request.match(/^@berry\/plugin-/))
    return true;

  return false;
};
