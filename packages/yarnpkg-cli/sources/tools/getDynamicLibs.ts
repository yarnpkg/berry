const DYNAMIC_LIBS = [
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
];

export const getDynamicLibs = () => {
  return new Map(DYNAMIC_LIBS.map(name => {
    return [name, require(name)];
  }));
};
