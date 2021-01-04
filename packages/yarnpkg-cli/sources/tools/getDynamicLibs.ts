export const getDynamicLibs = () => new Map([
  [`@yarnpkg/cli`, require(`@yarnpkg/cli`)],
  [`@yarnpkg/core`, require(`@yarnpkg/core`)],
  [`@yarnpkg/fslib`, require(`@yarnpkg/fslib`)],
  [`@yarnpkg/libzip`, require(`@yarnpkg/libzip`)],
  [`@yarnpkg/parsers`, require(`@yarnpkg/parsers`)],
  [`@yarnpkg/shell`, require(`@yarnpkg/shell`)],

  // Those ones are always useful
  [`clipanion`, require(`clipanion`)],
  [`semver`, require(`semver`)],
  [`yup`, require(`yup`)],
]);
