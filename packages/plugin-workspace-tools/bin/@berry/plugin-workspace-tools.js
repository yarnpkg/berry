
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
const foreach_1 = __importDefault(__webpack_require__(1));
const plugin = {
    commands: [
        foreach_1.default,
    ],
};
// eslint-disable-next-line arca/no-default-export
exports.default = plugin;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __webpack_require__(2);
const core_2 = __webpack_require__(2);
const core_3 = __webpack_require__(2);
const os_1 = __webpack_require__(3);
const p_limit_1 = __importDefault(__webpack_require__(4));
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`workspaces foreach <command> [...args] [-p,--parallel] [--with-dependencies] [-I,--interlaced] [-P,--prefixed] [-i,--include WORKSPACES...] [-x,--exclude WORKSPACES...]`)
    .flags({ proxyArguments: true })
    .categorize(`Workspace-related commands`)
    .describe(`run a command on all workspaces`)
    .action(async (_a) => {
    var { cwd, args, stdout, command, exclude, include, interlaced, parallel, withDependencies, prefixed } = _a, env = __rest(_a, ["cwd", "args", "stdout", "command", "exclude", "include", "interlaced", "parallel", "withDependencies", "prefixed"]);
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { project } = await core_1.Project.find(configuration, cwd);
    const cache = await core_2.Cache.find(configuration);
    const needsProcessing = new Map();
    const processing = new Set();
    const concurrency = parallel ? Math.max(1, os_1.cpus().length / 2) : 1;
    const limit = p_limit_1.default(concurrency);
    let commandCount = 0;
    const resolutionReport = await core_2.LightReport.start({ configuration, stdout }, async (report) => {
        await project.resolveEverything({ lockfileOnly: true, cache, report });
    });
    if (resolutionReport.hasErrors())
        return resolutionReport.exitCode();
    const runReport = await core_2.StreamReport.start({ configuration, stdout }, async (report) => {
        let workspaces = command.toLowerCase() === `run`
            ? project.workspaces.filter(workspace => workspace.manifest.scripts.has(args[0]))
            : project.workspaces;
        if (include.length > 0)
            workspaces = workspaces.filter(workspace => include.includes(workspace.locator.name));
        if (exclude.length > 0)
            workspaces = workspaces.filter(workspace => !exclude.includes(workspace.locator.name));
        for (const workspace of workspaces)
            needsProcessing.set(workspace.anchoredLocator.locatorHash, workspace);
        while (needsProcessing.size > 0) {
            const commandPromises = [];
            for (const [identHash, workspace] of needsProcessing) {
                // If we are already running the command on that workspace, skip
                if (processing.has(workspace.anchoredDescriptor.descriptorHash))
                    continue;
                let isRunnable = true;
                // By default we do topological, however we don't care of the order when running
                // in --parallel unless also given the --with-dependencies flag
                if (!parallel || withDependencies) {
                    for (const [identHash, descriptor] of workspace.dependencies) {
                        const locatorHash = project.storedResolutions.get(descriptor.descriptorHash);
                        if (typeof locatorHash === `undefined`)
                            throw new Error(`Assertion failed: The resolution should have been registered`);
                        if (needsProcessing.has(locatorHash)) {
                            isRunnable = false;
                            break;
                        }
                    }
                }
                if (!isRunnable)
                    continue;
                processing.add(workspace.anchoredDescriptor.descriptorHash);
                commandPromises.push(limit(async () => {
                    await runCommand(workspace, {
                        commandIndex: ++commandCount,
                    });
                    needsProcessing.delete(identHash);
                    processing.delete(workspace.anchoredDescriptor.descriptorHash);
                }));
            }
            if (commandPromises.length === 0)
                return report.reportError(core_2.MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected`);
            await Promise.all(commandPromises);
        }
        async function runCommand(workspace, { commandIndex }) {
            const prefix = getPrefix(workspace, { configuration, prefixed, commandIndex });
            const stdout = createStream(report, { prefix, interlaced });
            const stderr = createStream(report, { prefix, interlaced });
            try {
                await clipanion.run(null, args, Object.assign({}, env, { cwd: workspace.cwd, stdout: stdout, stderr: stderr }));
            }
            finally {
                stdout.end();
                stderr.end();
            }
            // If we don't wait for the `end` event, there is a race condition
            // between this function (`runCommand`) completing and report.exitCode()
            // being called which will trigger StreamReport finalize and we would get
            // something like `➤ YN0000: Done in Ns` before all the commands complete.
            await Promise.all([
                new Promise(resolve => stdout.on(`end`, resolve)),
                new Promise(resolve => stderr.on(`end`, resolve)),
            ]);
        }
    });
    return runReport.exitCode();
});
function createStream(report, { prefix, interlaced }) {
    const streamReporter = report.createStreamReporter(prefix);
    if (interlaced)
        return streamReporter;
    const streamBuffer = new core_3.miscUtils.BufferStream();
    streamBuffer.pipe(streamReporter);
    return streamBuffer;
}
function getPrefix(workspace, { configuration, commandIndex, prefixed }) {
    if (!prefixed)
        return null;
    const ident = core_3.structUtils.convertToIdent(workspace.locator);
    const name = core_3.structUtils.stringifyIdent(ident);
    let prefix = `[${name}]:`;
    const colors = [`cyan`, `green`, `yellow`, `blue`, `magenta`];
    const colorName = colors[commandIndex % colors.length];
    return configuration.format(prefix, colorName);
}


/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("@berry/core");

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("os");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const pTry = __webpack_require__(5);

const pLimit = concurrency => {
	if (concurrency < 1) {
		throw new TypeError('Expected `concurrency` to be a number from 1 and up');
	}

	const queue = [];
	let activeCount = 0;

	const next = () => {
		activeCount--;

		if (queue.length > 0) {
			queue.shift()();
		}
	};

	const run = (fn, resolve, ...args) => {
		activeCount++;

		const result = pTry(fn, ...args);

		resolve(result);

		result.then(next, next);
	};

	const enqueue = (fn, resolve, ...args) => {
		if (activeCount < concurrency) {
			run(fn, resolve, ...args);
		} else {
			queue.push(run.bind(null, fn, resolve, ...args));
		}
	};

	const generator = (fn, ...args) => new Promise(resolve => enqueue(fn, resolve, ...args));
	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount
		},
		pendingCount: {
			get: () => queue.length
		}
	});

	return generator;
};

module.exports = pLimit;
module.exports.default = pLimit;


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = (callback, ...args) => new Promise(resolve => {
	resolve(callback(...args));
});


/***/ })
/******/ ]);
                      return plugin;
                    };

                    module.exports.name = "@berry/plugin-workspace-tools";
                  