export const getDynamicLibs = () => new Map([
  [`@yarnpkg/cli`, require(`@yarnpkg/cli`)],
  [`@yarnpkg/core`, require(`@yarnpkg/core`)],
  [`@yarnpkg/fslib`, require(`@yarnpkg/fslib`)],
  [`@yarnpkg/libzip`, require(`@yarnpkg/libzip`)],
  [`@yarnpkg/parsers`, require(`@yarnpkg/parsers`)],
  [`@yarnpkg/shell`, require(`@yarnpkg/shell`)],

  // Those ones are always useful
<<<<<<< HEAD
  [`clipanion`, require(`clipanion`)],
  [`semver`, require(`semver`)],
  [`yup`, require(`yup`)],
]);
=======
  `clipanion`,
  `semver`,
  `typanion`,
];

export const getDynamicLibs = () => {
  return new Map(DYNAMIC_LIBS.map(name => {
    return [name, require(name)];
  }));
};
>>>>>>> origin/master
