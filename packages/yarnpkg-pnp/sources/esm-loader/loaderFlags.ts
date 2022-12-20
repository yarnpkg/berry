const [major, minor] = process.versions.node.split(`.`).map(value => parseInt(value, 10));

// The hooks were consolidated in https://github.com/nodejs/node/pull/37468
export const HAS_CONSOLIDATED_HOOKS = major > 16 || (major === 16 && minor >= 12);

// JSON modules were unflagged in https://github.com/nodejs/node/pull/41736
export const HAS_UNFLAGGED_JSON_MODULES = major > 17 || (major === 17 && minor >= 5) || (major === 16 && minor >= 15);

// JSON modules requires import assertions after https://github.com/nodejs/node/pull/40250
export const HAS_JSON_IMPORT_ASSERTION_REQUIREMENT = major > 17 || (major === 17 && minor >= 1) || (major === 16 && minor > 14);

// The message switched to using an array in https://github.com/nodejs/node/pull/45348
export const WATCH_MODE_MESSAGE_USES_ARRAYS = major > 19 || (major === 19 && minor >= 2);
