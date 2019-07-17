const {UsageError} = require(`clipanion`);

module.exports = function ({basedir, profile, plugins}) {
  const pkgJson = require(`${basedir}/package.json`);

  if (!pkgJson[`@berry/builder`] || !pkgJson[`@berry/builder`].bundles)
    throw new UsageError(`This command requires your package.json to contain specific configuration keys`);

  if (!profile)
    profile = `standard`;

  const profiles = profile.split(/\+/g);

  if (!profiles.every(profile => Object.prototype.hasOwnProperty.call(pkgJson[`@berry/builder`].bundles, profile)))
    throw new UsageError(`Invalid profile`);

  return Array.from(new Set(profiles.reduce((acc, profile) => {
    return acc.concat(pkgJson[`@berry/builder`].bundles[profile]);
  }, plugins)));
};
