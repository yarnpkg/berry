"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clipanion_1 = require("clipanion");
function findPlugins({ basedir, profile, plugins }) {
    const pkgJson = require(`${basedir}/package.json`);
    if (!pkgJson[`@berry/builder`] || !pkgJson[`@berry/builder`].bundles)
        throw new clipanion_1.UsageError(`This command requires your package.json to contain specific configuration keys`);
    if (!profile)
        profile = `standard`;
    const profiles = profile.split(/\+/g);
    const supported = new Set(Object.keys(pkgJson[`@berry/builder`].bundles));
    if (profiles.some(profile => !supported.has(profile)))
        throw new clipanion_1.UsageError(`Invalid profile "${profile}", expected one of ${[...supported].join(`, `)}`);
    return Array.from(new Set(profiles.reduce((acc, profile) => {
        return acc.concat(pkgJson[`@berry/builder`].bundles[profile]);
    }, plugins)));
}
exports.findPlugins = findPlugins;
