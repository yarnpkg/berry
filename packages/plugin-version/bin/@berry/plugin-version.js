
                    module.exports = {};

                    module.exports.factory = function (require) {
                      var plugin =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apply_1 = __importDefault(__webpack_require__(1));
const major_1 = __importDefault(__webpack_require__(7));
const minor_1 = __importDefault(__webpack_require__(8));
const patch_1 = __importDefault(__webpack_require__(9));
const plugin = {
    commands: [
        apply_1.default,
        major_1.default,
        minor_1.default,
        patch_1.default,
    ],
};
// eslint-disable-next-line arca/no-default-export
exports.default = plugin;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const core_2 = __webpack_require__(3);
const core_3 = __webpack_require__(3);
const versionUtils = __importStar(__webpack_require__(4));
const SUPPORTED_UPGRADE_REGEXP = /^([~^]?)[0-9]+\.[0-9]+\.[0-9]+$/;
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`version apply [--all]`)
    .categorize(`Release-related commands`)
    .describe(`apply all the deferred version bumps at once`)
    .detail(`
    This command will apply the deferred version changes (scheduled via \`yarn version major|minor|patch\`) on the current workspace (or all of them if \`--all\`) is specified.

    It will also update the \`workspace:\` references across all your local workspaces so that they keep refering to the same workspace even after the version bump.
  `)
    .example(`Apply the version change to the local workspace`, `yarn version apply`)
    .example(`Apply the version change to all the workspaces in the local workspace`, `yarn version apply --all`)
    .action(async ({ cwd, stdout, all }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { project, workspace } = await core_2.Project.find(configuration, cwd);
    const cache = await core_1.Cache.find(configuration);
    if (!workspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    const resolutionReport = await core_1.LightReport.start({ configuration, stdout }, async (report) => {
        await project.resolveEverything({ lockfileOnly: true, cache, report });
    });
    if (resolutionReport.hasErrors())
        return resolutionReport.exitCode();
    const applyReport = await core_2.StreamReport.start({ configuration, stdout }, async (report) => {
        const allDependents = new Map();
        // First we compute the reverse map to figure out which workspace is
        // depended upon by which other.
        // 
        // Note that we need to do this before applying the new versions,
        // otherwise the `findWorkspacesByDescriptor` calls won't be able to
        // resolve the workspaces anymore (because the workspace versions will
        // have changed and won't match the outdated dependencies).
        for (const dependent of project.workspaces) {
            for (const set of core_1.Manifest.allDependencies) {
                for (const descriptor of dependent.manifest[set].values()) {
                    const workspaces = project.findWorkspacesByDescriptor(descriptor);
                    if (workspaces.length !== 1)
                        continue;
                    // When operating on a single workspace, we don't have to compute
                    // the dependencies for the other ones
                    const dependency = workspaces[0];
                    if (!all && dependency !== workspace)
                        continue;
                    let dependents = allDependents.get(dependency);
                    if (typeof dependents === `undefined`)
                        allDependents.set(dependency, dependents = []);
                    dependents.push([dependent, set, descriptor.identHash]);
                }
            }
        }
        // Now that we know which workspaces depend on which others, we can
        // proceed to update everything at once using our accumulated knowledge.
        const processWorkspace = (workspace) => {
            const newVersion = versionUtils.applyNextVersion(workspace);
            if (newVersion === null)
                return;
            report.reportInfo(core_2.MessageName.UNNAMED, `${core_3.structUtils.prettyLocator(configuration, workspace.anchoredLocator)}: Bumped to ${newVersion}`);
            const dependents = allDependents.get(workspace);
            if (typeof dependents === `undefined`)
                return;
            for (const [dependent, set, identHash] of dependents) {
                const descriptor = dependent.manifest[set].get(identHash);
                if (typeof descriptor === `undefined`)
                    throw new Error(`Assertion failed: The dependency should have existed`);
                let range = descriptor.range;
                let useWorkspaceProtocol = false;
                if (range.startsWith(core_2.WorkspaceResolver.protocol)) {
                    range = range.slice(core_2.WorkspaceResolver.protocol.length);
                    useWorkspaceProtocol = true;
                    // Workspaces referenced through their path never get upgraded ("workspace:packages/berry-core")
                    if (range === workspace.relativeCwd) {
                        continue;
                    }
                }
                // We can only auto-upgrade the basic semver ranges (we can't auto-upgrade ">=1.0.0 <2.0.0", for example)
                const parsed = range.match(SUPPORTED_UPGRADE_REGEXP);
                if (!parsed) {
                    report.reportWarning(core_2.MessageName.UNNAMED, `Couldn't auto-upgrade range ${range} (in ${core_3.structUtils.prettyLocator(configuration, workspace.anchoredLocator)})`);
                    continue;
                }
                let newRange = `${parsed[1]}${newVersion}`;
                if (useWorkspaceProtocol)
                    newRange = `${core_2.WorkspaceResolver.protocol}${newRange}`;
                const newDescriptor = core_3.structUtils.makeDescriptor(descriptor, newRange);
                dependent.manifest[set].set(identHash, newDescriptor);
            }
        };
        if (!all) {
            processWorkspace(workspace);
        }
        else {
            for (const workspace of project.workspaces) {
                processWorkspace(workspace);
            }
        }
        await project.persist();
    });
    return applyReport.exitCode();
});


/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("@berry/cli");

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("@berry/core");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clipanion_1 = __webpack_require__(5);
const semver_1 = __importDefault(__webpack_require__(6));
function registerNextVersion(workspace, level) {
    if (workspace.manifest.version == null)
        throw new clipanion_1.UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);
    const version = workspace.manifest.version;
    if (typeof version !== `string` || !semver_1.default.valid(version))
        throw new clipanion_1.UsageError(`Can't bump the version (${version}) if it's not valid semver`);
    return workspace.manifest.setRawField(`version:next`, semver_1.default.inc(version, level), {
        after: [`version`],
    });
}
exports.registerNextVersion = registerNextVersion;
function applyNextVersion(workspace) {
    if (!workspace.manifest.raw || !workspace.manifest.raw[`version:next`])
        return null;
    const newVersion = workspace.manifest.raw[`version:next`];
    if (typeof newVersion !== `string` || !semver_1.default.valid(newVersion))
        throw new clipanion_1.UsageError(`Can't apply the version bump if the resulting version (${newVersion}) isn't valid semver`);
    workspace.manifest.version = newVersion;
    workspace.manifest.raw[`version:next`] = undefined;
    return newVersion;
}
exports.applyNextVersion = applyNextVersion;


/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("clipanion");

/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = require("semver");

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const versionUtils = __importStar(__webpack_require__(4));
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`version major`)
    .categorize(`Release-related commands`)
    .describe(`bump the major number at the next release`)
    .detail(`
    This command will instruct Yarn to bump the major number (ie \`X.0.0\`) the next time you'll apply the version changes via \`yarn version apply\`.

    Note that contrary to its effect in Yarn v1, the effect isn't actually applied until you explicitly say so. For this reason calling the command twice is safe and won't bump your package by two different major numbers.

    Calling \`yarn version major\` will invalid any previous call to \`yarn version minor\` and \`yarn version patch\` (the highest bump takes precedence).
  `)
    .example(`Prepare the major number for a bump`, `yarn version major`)
    .action(async ({ cwd }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { workspace } = await core_1.Project.find(configuration, cwd);
    if (!workspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    await versionUtils.registerNextVersion(workspace, `major`);
    await workspace.persistManifest();
});


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const versionUtils = __importStar(__webpack_require__(4));
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`version minor`)
    .categorize(`Release-related commands`)
    .describe(`bump the minor number at the next release`)
    .detail(`
    This command will instruct Yarn to bump the minor release (ie \`0.X.0\`) the next time you'll apply the version changes via \`yarn version apply\`.

    Note that contrary to its effect in Yarn v1, the effect isn't actually applied until you explicitly say so. For this reason calling the command twice is safe and won't bump your package by two different minor numbers.

    Calling \`yarn version minor\` will invalid any previous call to \`yarn version patch\`, and won't have any effect if \`yarn version major\` was called before (the highest bump takes precedence).
  `)
    .example(`Prepare the major number for a bump`, `yarn version major`)
    .action(async ({ cwd }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { workspace } = await core_1.Project.find(configuration, cwd);
    if (!workspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    await versionUtils.registerNextVersion(workspace, `minor`);
    await workspace.persistManifest();
});


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const versionUtils = __importStar(__webpack_require__(4));
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`version patch`)
    .categorize(`Release-related commands`)
    .describe(`bump the patch number at the next release`)
    .detail(`
    This command will instruct Yarn to bump the patch number (ie \`0.0.X\`) the next time you'll apply the version changes via \`yarn version apply\`.

    Note that contrary to its effect in Yarn v1, the effect isn't actually applied until you explicitly say so. For this reason calling the command twice is safe and won't bump your package by two different patch numbers.

    Calling \`yarn version patch\` won't have any effect if \`yarn version major\` or \`yarn version minor\` were called before (the highest bump takes precedence).
  `)
    .example(`Prepare the major number for a bump`, `yarn version major`)
    .action(async ({ cwd }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { workspace } = await core_1.Project.find(configuration, cwd);
    if (!workspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    await versionUtils.registerNextVersion(workspace, `patch`);
    await workspace.persistManifest();
});


/***/ })
/******/ ]);
                      return plugin;
                    };

                    module.exports.name = "@berry/plugin-version";
                  