const [major, minor] = process.versions.node.split(`.`).map(value => parseInt(value, 10));

// The message switched to using an array in https://github.com/nodejs/node/pull/45348
export const WATCH_MODE_MESSAGE_USES_ARRAYS = major > 19 || (major === 19 && minor >= 2) || (major === 18 && minor >= 13);

// https://github.com/nodejs/node/pull/45659 changed the internal translators to be lazy loaded so they use our patch.
// https://github.com/nodejs/node/pull/48842 changed it so that our patch is loaded after the internal translators.
// TODO: Update the version range if https://github.com/nodejs/node/pull/46425 lands.
export const HAS_LAZY_LOADED_TRANSLATORS = (major === 20 && minor < 6) || (major === 19 && minor >= 3);

// https://github.com/nodejs/node/pull/43772
// TODO: Update the version range if it gets backported to v18.
export const HAS_LOADERS_AFFECTING_LOADERS = major > 19 || (major === 19 && minor >= 6);

// https://github.com/nodejs/node/pull/49869
export const ALLOWS_EXTENSIONLESS_FILES = major >= 21 || (major === 20 && minor >= 10) || (major === 18 && minor >= 19);

// https://github.com/nodejs/node/pull/50140
export const SUPPORTS_IMPORT_ATTRIBUTES = major >= 21 || (major === 20 && minor >= 10) || (major === 18 && minor >= 20);

// https://github.com/nodejs/node/pull/52104
export const SUPPORTS_IMPORT_ATTRIBUTES_ONLY = major >= 22;
