
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
const os_1 = __webpack_require__(4);
const p_limit_1 = __importDefault(__webpack_require__(5));
const yup = __importStar(__webpack_require__(7));
/**
 * Retrieves all the child workspaces of a given root workspace recursively
 *
 * @param rootWorkspace root workspace
 * @param project project
 *
 * @returns all the child workspaces
 */
const getWorkspaceChildrenRecursive = (rootWorkspace, project) => {
    const workspaceList = [];
    for (const childWorkspaceCwd of rootWorkspace.workspacesCwds) {
        const childWorkspace = project.workspacesByCwd.get(childWorkspaceCwd);
        if (childWorkspace) {
            workspaceList.push(childWorkspace, ...getWorkspaceChildrenRecursive(childWorkspace, project));
        }
    }
    return workspaceList;
};
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`workspaces foreach <command> [... rest] [-v,--verbose] [-p,--parallel] [-i,--interlaced] [-j,--jobs JOBS] [--topological] [--topological-dev] [--all] [--include WORKSPACES...] [--exclude WORKSPACES...]`)
    .categorize(`Workspace-related commands`)
    .describe(`run a command on all workspaces`)
    .flags({ proxyArguments: true })
    .detail(`
    This command will run a given sub-command on all child workspaces that define it (any workspace that doesn't define it will be just skiped). Various flags can alter the exact behavior of the command:

    - If \`-p,--parallel\` is set, the commands will run in parallel; they'll by default be limited to a number of parallel tasks roughly equal to half your core number, but that can be overriden via \`-j,--jobs\`.

    - If \`-p,--parallel\` and \`-i,--interlaced\` are both set, Yarn will print the lines from the output as it receives them. If \`-i,--interlaced\` wasn't set, it would instead buffer the output from each process and print the resulting buffers only after their source processes have exited.

    - If \`--topological\` is set, Yarn will only run a command after all workspaces that depend on it through the \`dependencies\` field have successfully finished executing. If \`--tological-dev\` is set, both the \`dependencies\` and \`devDependencies\` fields will be considered when figuring out the wait points.

    - If \`--all\` is set, Yarn will run it on all the workspaces of a project. By default it runs the command only on child workspaces.

    - The command may apply to only some workspaces through the use of \`--include\` which acts as a whitelist. The \`--exclude\` flag will do the opposite and will be a list of packages that musn't execute the script.

    Adding the \`-v,--verbose\` flag will cause Yarn to print more information; in particular the name of the workspace that generated the output will be printed at the front of each line.

    If the command is \`run\` and the script being run does not exist the child workspace will be skipped without error.
  `)
    .validate(yup.object().shape({
    jobs: yup.number().min(2),
    parallel: yup.boolean().when(`jobs`, {
        is: val => val > 1,
        then: yup.boolean().oneOf([true], `--parallel must be set when using --jobs`),
        otherwise: yup.boolean(),
    }),
}))
    .action(async (_a) => {
    var { cwd, stdout, command, rest, exclude, include, interlaced, parallel, topological, topologicalDev, all, verbose, jobs } = _a, env = __rest(_a, ["cwd", "stdout", "command", "rest", "exclude", "include", "interlaced", "parallel", "topological", "topologicalDev", "all", "verbose", "jobs"]);
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { project, workspace: cwdWorkspace } = await core_1.Project.find(configuration, cwd);
    if (!all && !cwdWorkspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    const rootWorkspace = all
        ? project.topLevelWorkspace
        : cwdWorkspace;
    const candidates = [rootWorkspace, ...getWorkspaceChildrenRecursive(rootWorkspace, project)];
    const workspaces = [];
    for (const workspace of candidates) {
        if (command === 'run' && rest.length > 0 && !workspace.manifest.scripts.has(rest[0]))
            continue;
        // Prevents infinite loop in the case of configuring a script as such:
        //     "lint": "yarn workspaces foreach --all lint"
        if ((command === 'run' && rest.length > 0 &&
            rest[0] === process.env.npm_lifecycle_event ||
            command === process.env.npm_lifecycle_event) &&
            workspace.cwd === cwdWorkspace.cwd)
            continue;
        if (include.length > 0 && !include.includes(workspace.locator.name))
            continue;
        if (exclude.length > 0 && exclude.includes(workspace.locator.name))
            continue;
        workspaces.push(workspace);
    }
    // No need to buffer the output if we're executing the commands sequentially
    if (!parallel)
        interlaced = true;
    const needsProcessing = new Map();
    const processing = new Set();
    const concurrency = parallel ? Math.max(1, os_1.cpus().length / 2) : 1;
    const limit = p_limit_1.default(jobs || concurrency);
    let commandCount = 0;
    const report = await core_2.StreamReport.start({ configuration, stdout }, async (report) => {
        for (const workspace of workspaces)
            needsProcessing.set(workspace.anchoredLocator.locatorHash, workspace);
        while (needsProcessing.size > 0) {
            if (report.hasErrors())
                break;
            const commandPromises = [];
            for (const [identHash, workspace] of needsProcessing) {
                // If we are already running the command on that workspace, skip
                if (processing.has(workspace.anchoredDescriptor.descriptorHash))
                    continue;
                let isRunnable = true;
                if (topological || topologicalDev) {
                    const resolvedSet = topologicalDev
                        ? [...workspace.manifest.dependencies, ...workspace.manifest.devDependencies]
                        : workspace.manifest.dependencies;
                    for (const [/*identHash*/ , descriptor] of resolvedSet) {
                        const workspaces = project.findWorkspacesByDescriptor(descriptor);
                        isRunnable = !workspaces.some(workspace => {
                            return needsProcessing.has(workspace.anchoredLocator.locatorHash);
                        });
                        if (!isRunnable) {
                            break;
                        }
                    }
                }
                if (!isRunnable)
                    continue;
                processing.add(workspace.anchoredDescriptor.descriptorHash);
                commandPromises.push(limit(async () => {
                    const exitCode = await runCommand(workspace, {
                        commandIndex: ++commandCount,
                    });
                    needsProcessing.delete(identHash);
                    processing.delete(workspace.anchoredDescriptor.descriptorHash);
                    return exitCode;
                }));
                // If we're not executing processes in parallel we can just wait for it
                // to finish outside of this loop (it'll then reenter it anyway)
                if (!parallel) {
                    break;
                }
            }
            if (commandPromises.length === 0) {
                const cycle = Array.from(needsProcessing.values()).map(workspace => {
                    return core_3.structUtils.prettyLocator(configuration, workspace.anchoredLocator);
                }).join(`, `);
                return report.reportError(core_2.MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected (${cycle})`);
            }
            const exitCodes = await Promise.all(commandPromises);
            if ((topological || topologicalDev) && exitCodes.some(exitCode => exitCode !== 0)) {
                report.reportError(core_2.MessageName.UNNAMED, `The command failed for workspaces that are depended upon by other workspaces; can't satisfy the dependency graph`);
            }
        }
        async function runCommand(workspace, { commandIndex }) {
            if (!parallel && verbose && commandIndex > 1)
                report.reportSeparator();
            const prefix = getPrefix(workspace, { configuration, verbose, commandIndex });
            const [stdout, stdoutEnd] = createStream(report, { prefix, interlaced });
            const [stderr, stderrEnd] = createStream(report, { prefix, interlaced });
            try {
                const exitCode = await clipanion.run(null, [command, ...rest], Object.assign({}, env, { cwd: workspace.cwd, stdout: stdout, stderr: stderr }));
                stdout.end();
                stderr.end();
                const emptyStdout = await stdoutEnd;
                const emptyStderr = await stderrEnd;
                if (verbose && emptyStdout && emptyStderr)
                    report.reportInfo(null, `${prefix} Process exited without output (exit code ${exitCode || 0})`);
                return exitCode || 0;
            }
            catch (err) {
                stdout.end();
                stderr.end();
                await stdoutEnd;
                await stderrEnd;
                throw err;
            }
        }
    });
    return report.exitCode();
});
function createStream(report, { prefix, interlaced }) {
    const streamReporter = report.createStreamReporter(prefix);
    const defaultStream = new core_3.miscUtils.DefaultStream();
    defaultStream.pipe(streamReporter, { end: false });
    defaultStream.on(`finish`, () => {
        streamReporter.end();
    });
    const promise = new Promise(resolve => {
        streamReporter.on(`finish`, () => {
            resolve(defaultStream.active);
        });
    });
    if (interlaced)
        return [defaultStream, promise];
    const streamBuffer = new core_3.miscUtils.BufferStream();
    streamBuffer.pipe(defaultStream, { end: false });
    streamBuffer.on(`finish`, () => {
        defaultStream.end();
    });
    return [streamBuffer, promise];
}
function getPrefix(workspace, { configuration, commandIndex, verbose }) {
    if (!verbose)
        return null;
    const ident = core_3.structUtils.convertToIdent(workspace.locator);
    const name = core_3.structUtils.stringifyIdent(ident);
    let prefix = `[${name}]:`;
    const colors = [`#2E86AB`, `#A23B72`, `#F18F01`, `#C73E1D`, `#CCE2A3`];
    const colorName = colors[commandIndex % colors.length];
    return configuration.format(prefix, colorName);
}


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
/***/ (function(module, exports) {

module.exports = require("os");

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const pTry = __webpack_require__(6);

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
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = (callback, ...args) => new Promise(resolve => {
	resolve(callback(...args));
});


/***/ }),
/* 7 */
/***/ (function(module, exports) {

module.exports = require("yup");

/***/ })
/******/ ]);
                      return plugin;
                    };

                    module.exports.name = "@berry/plugin-workspace-tools";
                  