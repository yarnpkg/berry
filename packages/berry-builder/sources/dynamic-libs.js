module.exports = new Set([
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
