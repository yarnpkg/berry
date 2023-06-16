const [major, minor] = process.versions.node.split(`.`).map(value => parseInt(value, 10));

// JSON modules were unflagged in https://github.com/nodejs/node/pull/41736
export const HAS_UNFLAGGED_JSON_MODULES = major > 17 || (major === 17 && minor >= 5);

// JSON modules requires import assertions after https://github.com/nodejs/node/pull/40250
export const HAS_JSON_IMPORT_ASSERTION_REQUIREMENT = major > 17 || (major === 17 && minor >= 1);

// The message switched to using an array in https://github.com/nodejs/node/pull/45348
export const WATCH_MODE_MESSAGE_USES_ARRAYS = major > 19 || (major === 19 && minor >= 2) || (major === 18 && minor >= 13);

// https://github.com/nodejs/node/pull/45659 changed the internal translators to be lazy loaded
// TODO: Update the version range if https://github.com/nodejs/node/pull/46425 lands.
export const HAS_LAZY_LOADED_TRANSLATORS = major > 19 || (major === 19 && minor >= 3);

// https://github.com/nodejs/node/pull/42881
export const ALLOWS_NON_FILE_PARENT = major > 18 || (major === 18 && minor >= 1) || (major === 16 && minor >= 17);
