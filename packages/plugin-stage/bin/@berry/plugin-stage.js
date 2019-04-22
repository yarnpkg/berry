
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
const stage_1 = __importDefault(__webpack_require__(1));
const plugin = {
    commands: [
        stage_1.default,
    ],
};
// eslint-disable-next-line arca/no-default-export
exports.default = plugin;


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __webpack_require__(2);
const fslib_1 = __webpack_require__(3);
const clipanion_1 = __webpack_require__(4);
const path_1 = __webpack_require__(17);
const GitDriver_1 = __webpack_require__(21);
const MercurialDriver_1 = __webpack_require__(23);
const ALL_DRIVERS = [
    GitDriver_1.Driver,
    MercurialDriver_1.Driver,
];
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`stage [-c,--commit] [-r,--reset] [-u,--update] [-n,--dry-run]`)
    .describe(`add all yarn files to your vcs`)
    .detail(`
    This command will add to your staging area the files belonging to Yarn (typically any modified \`package.json\` and \`.yarnrc\` files, but also linker-generated files, cache data, etc). It will take your ignore list into account, so the cache files won't be added if the cache is ignored in a \`.gitignore\` file (assuming you use Git).
    
    Running \`--reset\` will instead remove them from the staging area (the changes will still be there, but won't be committed until you stage them back).

    Since the staging area is a non-existent concept in Mercurial, Yarn will always create a new commit when running this command on Mercurial repositories. You can get this behavior when using Git by using the \`--commit\` flag which will directly create a commit.
  `)
    .example(`Adds all modified project files to the staging area`, `yarn stage`)
    .example(`Creates a new commit containing all modified project files`, `yarn stage --commit`)
    .action(async ({ cwd, stdout, commit, reset, update, dryRun }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { project } = await core_1.Project.find(configuration, cwd);
    let { driver, root } = await findDriver(project.cwd);
    const basePaths = [
        configuration.get(`bstatePath`),
        configuration.get(`cacheFolder`),
        configuration.get(`globalFolder`),
        configuration.get(`virtualFolder`),
        configuration.get(`yarnPath`),
    ];
    await configuration.triggerHook((hooks) => {
        return hooks.populateYarnPaths;
    }, project, (path) => {
        basePaths.push(path);
    });
    const yarnPaths = new Set();
    // We try to follow symlinks to properly add their targets (for example
    // the cache folder could be a symlink to another folder from the repo)
    for (const basePath of basePaths)
        for (const path of resolveToVcs(root, basePath))
            yarnPaths.add(path);
    const yarnNames = new Set([
        configuration.get(`rcFilename`),
        configuration.get(`lockfileFilename`),
        `package.json`,
    ]);
    const changeList = await driver.filterChanges(root, yarnPaths, yarnNames);
    if (dryRun) {
        for (const file of changeList) {
            stdout.write(`${fslib_1.NodeFS.fromPortablePath(file)}\n`);
        }
    }
    else {
        if (changeList.length === 0) {
            stdout.write(`No changes found!`);
        }
        else if (commit) {
            await driver.makeCommit(root, changeList);
        }
        else if (reset) {
            await driver.makeReset(root, changeList);
        }
    }
});
async function findDriver(cwd) {
    let driver = null;
    let root = null;
    for (const candidate of ALL_DRIVERS) {
        if ((root = await candidate.findRoot(cwd)) !== null) {
            driver = candidate;
            break;
        }
    }
    if (driver === null || root === null)
        throw new clipanion_1.UsageError(`No stage driver has been found for your current project`);
    return { driver, root };
}
/**
 * Given two directories, this function will return the location of the second
 * one in the first one after properly resolving symlinks (kind of like a
 * realpath, except that we only resolve the last component of the original
 * path).
 *
 * If the second directory isn't in the first one, this function returns null.
 */
function resolveToVcs(cwd, path) {
    const resolved = [];
    if (path === null)
        return resolved;
    while (true) {
        // If the current element is within the repository, we flag it as something
        // that's part of the Yarn installation
        if (path === cwd || path.startsWith(`${cwd}/`))
            resolved.push(path);
        let stat;
        try {
            stat = fslib_1.xfs.statSync(path);
        }
        catch (error) {
            // ignore errors
            break;
        }
        // If it's a symbolic link then we also need to also consider its target as
        // part of the Yarn installation (unless it's outside of the repo)
        if (stat.isSymbolicLink()) {
            path = path_1.posix.resolve(path_1.posix.dirname(path), fslib_1.xfs.readlinkSync(path));
        }
        else {
            break;
        }
    }
    return resolved;
}


/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("@berry/core");

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("@berry/fslib");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

exports.UsageError = __webpack_require__(5).UsageError;
exports.Clipanion  = __webpack_require__(6).Clipanion;

exports.clipanion  = new exports.Clipanion();


/***/ }),
/* 5 */
/***/ (function(module, exports) {

exports.UsageError = class UsageError extends Error {

    constructor(message) {

        super(message);

        this.isUsageError = true;

    }

};


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

const chalk                                = __webpack_require__(7);
const fs                                   = __webpack_require__(15);
const camelCase                            = __webpack_require__(16);
const path                                 = __webpack_require__(17);

const { Command }                          = __webpack_require__(18);
const { UsageError }                       = __webpack_require__(5);
const { getOptionComponent, getUsageLine } = __webpack_require__(19);
const { parse }                            = __webpack_require__(20);

let standardOptions = [ {

    shortName: `h`,
    longName: `help`,

}, {

    shortName: null,
    longName: `clipanion-definitions`,

    hidden: true,

} ];

exports.Clipanion = class Clipanion {

    constructor({configKey = `config`} = {}) {

        this.configKey = configKey;

        this.commands = [];

        this.validator = null;
        this.options = standardOptions.slice();

        this.beforeEachList = [];
        this.afterEachList = [];

        if (this.configKey !== null) {
            this.options.push({
                longName: this.configKey,
                argumentName: `PATH`
            });
        }

    }

    beforeEach(callback) {

        this.beforeEachList.push(callback);

        return this;

    }

    afterEach(callback) {

        this.afterEachList.push(callback);

        return this;

    }

    topLevel(pattern) {

        if (Array.isArray(pattern))
            pattern = pattern.join(` `);

        let definition = parse(pattern);

        if (definition.path.length > 0)
            throw new Error(`The top-level pattern cannot have a command path; use command() instead`);

        if (definition.requiredArguments.length > 0)
            throw new Error(`The top-level pattern cannot have required arguments; use command() instead`);

        if (definition.optionalArguments.length > 0)
            throw new Error(`The top-level pattern cannot have optional arguments; use command() instead`);

        this.options = this.options.concat(definition.options);

        return this;

    }

    validate(validator) {

        this.validator = validator;

        return this;

    }

    directory(startingPath, recursive = true, pattern = /\.js$/) {

        if (true) {

            if (typeof startingPath === `string`)
                throw new Error(`In webpack mode, you must use require.context to provide the directory content yourself; a path isn't enough`);

            for (let entry of startingPath.keys()) {

                let pkg = startingPath(entry);
                let factory = pkg.default || pkg;

                factory(this);

            }

        } else {}

    }

    command(pattern) {

        if (Array.isArray(pattern))
            pattern = pattern.join(` `);

        let definition = parse(pattern);

        let command = new Command(this, definition);
        this.commands.push(command);

        return command;

    }

    error(error, { stream }) {

        if (error && error.isUsageError) {

            stream.write(`${chalk.red.bold(`Error`)}${chalk.bold(`:`)} ${error.message}\n`);

        } else if (error && error.message) {

            let stackIndex = error.stack ? error.stack.search(/\n *at /) : -1;

            if (stackIndex >= 0) {
                stream.write(`${chalk.red.bold(`Error`)}${chalk.bold(`:`)} ${error.message}${error.stack.substr(stackIndex)}\n`);
            } else {
                stream.write(`${chalk.red.bold(`Error`)}${chalk.bold(`:`)} ${error.message}\n`);
            }

        } else {

            stream.write(`${chalk.red.bold(`Error`)}${chalk.bold(`:`)} ${error}\n`);

        }

    }

    usage(argv0, { command = null, error = null, stream = process.stderr } = {}) {

        if (error) {

            this.error(error, { stream });

            stream.write(`\n`);

        }

        if (command) {

            let commandPath = command.path.join(` `);
            let usageLine = getUsageLine(command);

            if (!error) {

                if (command.description) {

                    let capitalized = command.description.replace(/^[a-z]/, $0 => $0.toUpperCase());

                    stream.write(capitalized);
                    stream.write(`\n`);

                }

                if (command.details || command.examples.length > 0) {

                    stream.write(`${chalk.bold(`Usage:`)}\n`);
                    stream.write(`\n`);
                    stream.write(`${argv0 || ``} ${commandPath} ${usageLine}\n`.replace(/ +/g, ` `).replace(/^ +| +$/g, ``));

                } else {

                    stream.write(`${chalk.bold(`Usage:`)} ${argv0 || ``} ${commandPath} ${usageLine}\n`.replace(/ +/g, ` `).replace(/^ +| +$/g, ``));

                }

                if (command.details) {

                    stream.write(`\n`);
                    stream.write(`${chalk.bold(`Details:`)}\n`);
                    stream.write(`\n`);

                    stream.write(command.details);

                }

                if (command.examples.length > 0) {

                    stream.write(`\n`);
                    stream.write(`${chalk.bold(`Examples:`)}\n`);

                    for (let {description, example} of command.examples) {
                        stream.write(`\n`);
                        stream.write(description);
                        stream.write(`\n`);
                        stream.write(example.replace(/^/m, `  `));
                    }

                }

            } else {

                stream.write(`${chalk.bold(`Usage:`)} ${argv0 || ``} ${commandPath} ${usageLine}\n`.replace(/ +/g, ` `).replace(/^ +| +$/g, ``));

            }

        } else {

            let globalOptions = getOptionComponent(this.options);

            stream.write(`${chalk.bold(`Usage:`)} ${argv0 || `<binary>`} ${globalOptions} <command>\n`.replace(/ +/g, ` `).replace(/ +$/, ``));

            let commandsByCategories = new Map();
            let maxPathLength = 0;

            for (const command of this.commands) {

                if (command.hiddenCommand || command.path.some(component => component.startsWith(`_`)))
                    continue;

                let categoryCommands = commandsByCategories.get(command.category);

                if (!categoryCommands)
                    commandsByCategories.set(command.category, categoryCommands = []);

                categoryCommands.push(command);

                let thisPathLength = command.path.join(` `).length;

                if (thisPathLength > maxPathLength) {
                    maxPathLength = thisPathLength;
                }

            }

            let categoryNames = Array.from(commandsByCategories.keys()).sort((a, b) => {

                if (a === null)
                    return -1;
                if (b === null)
                    return +1;

                return a.localeCompare(b, `en`, {usage: `sort`, caseFirst: `upper`});

            });

            for (let categoryName of categoryNames) {

                let commands = commandsByCategories.get(categoryName).slice().sort((a, b) => {

                    const aPath = a.path.join(` `);
                    const bPath = b.path.join(` `);

                    return aPath.localeCompare(bPath, `en`, {usage: `sort`, caseFirst: `upper`});

                });

                let header = categoryName !== null ? categoryName.trim() : `Where <command> is one of`;

                stream.write(`\n`);
                stream.write(`${chalk.bold(`${header}:`)}\n`);
                stream.write(`\n`);

                let pad = str => {
                    return `${str}${` `.repeat(maxPathLength - str.length)}`;
                };

                for (let command of commands) {
                    stream.write(`  ${chalk.bold(pad(command.path.join(` `)))}  ${command.description ? command.description.trim() : `undocumented`}\n`);
                }

            }

        }

    }

    definitions({ stream = process.stderr } = {}) {

        let commands = [];

        for (const command of this.commands) {
            if (!command.hiddenCommand) {
                commands.push({
                    path: command.path,
                    category: command.category,
                    usage: getUsageLine(command),
                    description: command.description,
                    details: command.details,
                    examples: command.examples,
                });
            }
        }

        stream.write(JSON.stringify({
            commands,
        }, null, 2));

    }

    check() {

        if (this.commands.filter(command => command.defaultCommand).length > 1)
            throw new Error(`Multiple commands have been flagged as default command`);

        let shortNames = this.options.map(option => option.shortName).filter(name => name);
        let longNames = this.options.map(option => option.longName).filter(name => name);

        let topLevelNames = [].concat(shortNames, longNames);

        if (new Set(topLevelNames).size !== topLevelNames.length)
            throw new Error(`Some top-level parameter names are conflicting together`);

        for (let command of this.commands) {
            command.check(topLevelNames);
        }

    }

    async run(argv0, argv, { stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, ... initialEnv } = {}) {

        // Sanity check to make sure that the configuration makes sense
        if (false)
            {}

        // This object is the one we'll fill with the parsed options
        let env = { argv0, stdin, stdout, stderr, ... initialEnv };

        // This array will contain the literals that will be forwarded to the command as positional arguments
        let rest = [];

        // We copy the global options from our initial environment into our new one (it's a form of inheritance)
        for (let option of this.options) {

            if (option.longName) {

                if (Object.prototype.hasOwnProperty.call(initialEnv, option.longName)) {
                    env[option.longName] = initialEnv[option.longName];
                }

            } else {

                if (Object.prototype.hasOwnProperty.call(initialEnv, option.shortName)) {
                    env[option.shortName] = initialEnv[option.shortName];
                }

            }

        }

        // This pointer contains the command we'll be using if nothing prevents it
        let selectedCommand = this.commands.find(command => command.defaultCommand);

        // This array is the list of the commands we might still have a chance to end up using
        let candidateCommands = this.commands;

        // This array is the list of the words that make up the selected command name
        let commandPath = [];

        // This array is the list of the words that might end up in a command name
        let commandBuffer = [];

        // True if a command has been locked (cannot be changed anymore), false otherwise
        let isCommandLocked = false;

        let LONG_OPTION = 0;
        let SHORT_OPTION = 1;
        let STOP_OPTION = 2;
        let MALFORMED_OPTION = 3;
        let RAW_STRING = 4;

        let LONG_OPTION_REGEXP = /^--(?:(no|without)-)?([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)(?:(=)(.*))?$/;
        let SHORT_OPTION_REGEXP = /^-([a-zA-Z])(?:=(.*))?(.*)$/;

        function lockCommand() {

            if (isCommandLocked)
                return;

            if (!selectedCommand)
                throw new UsageError(`No commands match the arguments you've providen`);

            // We can save what's left of our command buffer into the argv array that will be providen to the command
            rest = commandBuffer.slice(commandPath.length);

            isCommandLocked = true;

        }

        function getShortOption(short) {

            return options.find(option => {
                return option.shortName === short;
            });

        }

        function getLongOption(long) {

            return options.find(option => {
                return option.longName === long;
            });

        }

        function parseArgument(literal) {

            if (literal === `--`)
                return { type: STOP_OPTION, literal };

            if (literal.startsWith(`--`)) {

                let match = literal.match(LONG_OPTION_REGEXP);

                if (match) {
                    return { type: LONG_OPTION, literal, enabled: !match[1], name: (match[1] === `without` ? `with-` : ``) + match[2], value: match[3] ? match[4] || `` : undefined };
                } else {
                    return { type: MALFORMED_OPTION, literal };
                }

            }

            if (literal.startsWith(`-`)) {

                let match = literal.match(SHORT_OPTION_REGEXP);

                if (match) {
                    return { type: SHORT_OPTION, literal, leading: match[1], value: match[2], rest: match[3] };
                } else {
                    return { type: MALFORMED_OPTION, literal };
                }

            }

            return { type: RAW_STRING, literal };

        }

        try {

            let parsedArgv = argv.map(arg => parseArgument(arg));

            for (let t = 0, T = parsedArgv.length; t < T; ++t) {

                let current = parsedArgv[t];
                let next = parsedArgv[t + 1];

                // If we're currently processing a command that accepts arguments by proxy, we treat all following tokens as raw strings
                if (selectedCommand && selectedCommand.proxyArguments && rest.length >= selectedCommand.requiredArguments.length) {

                    current = {... current};
                    current.type = RAW_STRING;

                    next = {... next};
                    next.type = RAW_STRING;

                }

                switch (current.type) {

                    case MALFORMED_OPTION: {

                        throw new UsageError(`Malformed option "${current.literal}"`);

                    } break;

                    case STOP_OPTION: {

                        lockCommand();

                        for (t = t + 1; t < T; ++t) {
                            rest.push(parsedArgv[t].literal);
                        }

                    } break;

                    case SHORT_OPTION: {

                        let leadingOption = selectedCommand ? selectedCommand.options.find(option => option.shortName === current.leading) : null;

                        if (leadingOption)
                            lockCommand();
                        else
                            leadingOption = this.options.find(option => option.shortName === current.leading);

                        if (!leadingOption)
                            throw new UsageError(`Unknown option "${current.leading}"`);

                        if (leadingOption.argumentName) {

                            let value = current.value || current.rest || undefined;

                            if (!value && next && next.type === RAW_STRING) {
                                value = next.literal;
                                t += 1;
                            }

                            if (value === undefined)
                                throw new UsageError(`Option "${leadingOption.shortName}" cannot be used without argument`);

                            let envName = leadingOption.longName
                                ? camelCase(leadingOption.longName)
                                : leadingOption.shortName;

                            if (Array.isArray(leadingOption.initialValue)) {
                                if (env[envName]) {
                                    env[envName].push(value);
                                } else {
                                    env[envName] = [value];
                                }
                            } else {
                                env[envName] = value;
                            }

                        } else {

                            if (current.value)
                                throw new UsageError(`Option "${leadingOption.shortName}" doesn't expect any argument`);

                            if (!current.rest.match(/^[a-z0-9]*$/))
                                throw new UsageError(`Malformed option list "${current.literal}"`);

                            for (let optionName of [ current.leading, ... current.rest ]) {

                                let option = selectedCommand ? selectedCommand.options.find(option => option.shortName === optionName) : null;

                                if (option)
                                    lockCommand();
                                else
                                    option = this.options.find(option => option.shortName === optionName);

                                if (!option)
                                    throw new UsageError(`Unknown option "${optionName}"`);

                                if (option.argumentName)
                                    throw new UsageError(`Option "${optionName}" cannot be placed in an option list, because it expects an argument`);

                                if (option.maxValue !== undefined) {

                                    if (option.longName) {
                                        env[camelCase(option.longName)] = Math.min((env[camelCase(option.longName)] || option.initialValue) + 1, option.maxValue);
                                    } else {
                                        env[option.shortName] = Math.min((env[option.shortName] || option.initialValue) + 1, option.maxValue);
                                    }

                                } else {

                                    if (option.longName) {
                                        env[camelCase(option.longName)] = !option.initialValue;
                                    } else {
                                        env[option.shortName] = !option.initialValue;
                                    }

                                }

                            }

                        }

                    } break;

                    case LONG_OPTION: {

                        let option = selectedCommand ? selectedCommand.options.find(option => option.longName === current.name) : null;

                        if (option)
                            lockCommand();
                        else
                            option = this.options.find(option => option.longName === current.name);

                        if (!option)
                            throw new UsageError(`Unknown option "${current.name}"`);

                        let value;

                        if (option.argumentName) {

                            let disablePrefix = option.longName.startsWith(`with-`) ? `--without` : `--no`;

                            if (!current.enabled && current.value !== undefined)
                                throw new UsageError(`Option "${option.longName}" cannot have an argument when used with ${disablePrefix}`);

                            if (current.enabled) {

                                if (current.value !== undefined) {
                                    value = current.value;
                                } else if (next && next.type === RAW_STRING) {
                                    value = next.literal;
                                    t += 1;
                                } else {
                                    throw new UsageError(`Option "${option.longName}" cannot be used without argument. Use "${disablePrefix}-${option.longName}" instead`);
                                }

                            } else {

                                value = null;

                            }

                        } else {

                            if (current.value !== undefined)
                                throw new UsageError(`Option "${option.name}" doesn't expect any argument`);

                            if (current.enabled) {
                                value = true;
                            } else {
                                value = false;
                            }

                        }

                        let envName = option.longName
                            ? camelCase(option.longName)
                            : option.shortName;

                        if (Array.isArray(option.initialValue)) {
                            if (env[envName]) {
                                env[envName].push(value);
                            } else {
                                env[envName] = [value];
                            }
                        } else {
                            env[envName] = value;
                        }

                    } break;

                    case RAW_STRING: {

                        if (!isCommandLocked) {

                            let nextCandidates = candidateCommands.filter(command => command.path[commandBuffer.length] === current.literal);

                            commandBuffer.push(current.literal);

                            let nextSelectedCommand = nextCandidates.find(command => command.path.length === commandBuffer.length);

                            if (nextSelectedCommand) {
                                selectedCommand = nextSelectedCommand;
                                commandPath = commandBuffer;
                            }

                            candidateCommands = nextCandidates.filter(candidate => candidate !== nextSelectedCommand);

                            // If there's absolutely no other command we can switch to, then we can lock the current one right away, so that we can start parsing its options
                            if (candidateCommands.length === 0) {

                                lockCommand();

                            }

                        } else {

                            rest.push(current.literal);

                        }

                    } break;

                }

            }

            lockCommand();

            if (env.help) {

                if (commandPath.length > 0)
                    this.usage(argv0, { command: selectedCommand, stream: stdout });
                else
                    this.usage(argv0, { stream: stdout });

                return 0;

            }

            if (env.clipanionDefinitions) {

                this.definitions({ stream: stdout });

                return 0;

            }

            for (let name of selectedCommand.requiredArguments) {

                if (rest.length === 0)
                    throw new UsageError(`Missing required argument "${name}"`);

                env[camelCase(name)] = rest.shift();

            }

            for (let name of selectedCommand.optionalArguments) {

                if (rest.length === 0)
                    break;

                env[camelCase(name)] = rest.shift();

            }

            if (selectedCommand.spread)
                env[camelCase(selectedCommand.spread)] = rest;

            else if (rest.length > 0)
                throw new UsageError(`Too many arguments`);

            for (let option of [ ... selectedCommand.options, ... this.options ]) {

                let envName = option.longName
                    ? camelCase(option.longName)
                    : option.shortName;

                if (Object.prototype.hasOwnProperty.call(env, envName))
                    continue;

                env[envName] = option.initialValue;

            }

            if (this.configKey !== null && typeof env[this.configKey] !== `undefined`) {

                let configOptions = JSON.parse(fs.readFileSync(env[this.configKey], `utf8`));

                for (let name of Object.keys(configOptions)) {

                    let option = selectedCommand.options.find(option => option.longName === optionName);

                    if (!option)
                        option = this.options.find(option => option.longName === optionName);

                    if (!option)
                        continue;

                    if (configOptions[name] === undefined)
                        continue;

                    if (option.argumentName) {

                        if (typeof configOptions[name] === `string` || configOptions[name] === null) {
                            env[name] = configOptions[name];
                        } else {
                            throw new UsageError(`Option "${name}" must be a string, null, or undefined`);
                        }

                    } else {

                        if (option.maxValue !== undefined) {

                            if (Number.isInteger(configOptions[name])) {
                                env[name] = Math.max(0, Math.min(Number(configOptions[name]), option.maxValue));
                            } else {
                                throw new UsageError(`Option "${name}" must be a number or undefined`);
                            }

                        } else {

                            if (typeof configOptions[name] === `boolean`) {
                                env[name] = configOptions[name];
                            } else {
                                throw new UsageError(`Option "${name}" must be a boolean or undefined`);
                            }

                        }

                    }

                }

            }

            if (this.validator || selectedCommand.validator) {

                let schema = this.validator && selectedCommand.validator
                    ? this.validator.concat(selectedCommand.validator)
                    : this.validator || selectedCommand.validator;

                try {

                    env = await schema.validate(env);

                } catch (error) {

                    if (error && error.name === `ValidationError`) {

                        if (error.errors.length > 1) {
                            throw new UsageError(`Validation failed because ${error.errors.slice(0, -1).join(`, `)}, and ${error.errors[error.errors.length - 1]}`);
                        } else {
                            throw new UsageError(`Validation failed because ${error.errors[0]}`);
                        }

                    } else {

                        throw error;

                    }

                }

            }

            for (let beforeEach of this.beforeEachList)
                await beforeEach(env);

            let result = await selectedCommand.run(env);

            for (let afterEach of this.afterEachList)
                await afterEach(env, result);

            return result;

        } catch (error) {

            if (error && error.isUsageError) {

                this.usage(argv0, { command: selectedCommand, error, stream: stderr });

                return 1;

            } else {

                throw error;

            }

        }

        return undefined;

    }

    async runExit(argv0, argv, { stdin = process.stdin, stdout = process.stdout, stderr = process.stderr, ... rest } = {}) {

        try {

            process.exitCode = await this.run(argv0, argv, { stdin, stdout, stderr, ... rest });

        } catch (error) {

            this.error(error, { stream: stderr });

            process.exitCode = 1;

        }

    }

};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var escapeStringRegexp = __webpack_require__(8);
var ansiStyles = __webpack_require__(9);
var stripAnsi = __webpack_require__(11);
var hasAnsi = __webpack_require__(13);
var supportsColor = __webpack_require__(14);
var defineProps = Object.defineProperties;
var isSimpleWindowsTerm = process.platform === 'win32' && !/^xterm/i.test(process.env.TERM);

function Chalk(options) {
	// detect mode if not set manually
	this.enabled = !options || options.enabled === undefined ? supportsColor : options.enabled;
}

// use bright blue on Windows as the normal blue color is illegible
if (isSimpleWindowsTerm) {
	ansiStyles.blue.open = '\u001b[94m';
}

var styles = (function () {
	var ret = {};

	Object.keys(ansiStyles).forEach(function (key) {
		ansiStyles[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles[key].close), 'g');

		ret[key] = {
			get: function () {
				return build.call(this, this._styles.concat(key));
			}
		};
	});

	return ret;
})();

var proto = defineProps(function chalk() {}, styles);

function build(_styles) {
	var builder = function () {
		return applyStyle.apply(builder, arguments);
	};

	builder._styles = _styles;
	builder.enabled = this.enabled;
	// __proto__ is used because we must return a function, but there is
	// no way to create a function with a different prototype.
	/* eslint-disable no-proto */
	builder.__proto__ = proto;

	return builder;
}

function applyStyle() {
	// support varags, but simply cast to string in case there's only one arg
	var args = arguments;
	var argsLen = args.length;
	var str = argsLen !== 0 && String(arguments[0]);

	if (argsLen > 1) {
		// don't slice `arguments`, it prevents v8 optimizations
		for (var a = 1; a < argsLen; a++) {
			str += ' ' + args[a];
		}
	}

	if (!this.enabled || !str) {
		return str;
	}

	var nestedStyles = this._styles;
	var i = nestedStyles.length;

	// Turns out that on Windows dimmed gray text becomes invisible in cmd.exe,
	// see https://github.com/chalk/chalk/issues/58
	// If we're on Windows and we're dealing with a gray color, temporarily make 'dim' a noop.
	var originalDim = ansiStyles.dim.open;
	if (isSimpleWindowsTerm && (nestedStyles.indexOf('gray') !== -1 || nestedStyles.indexOf('grey') !== -1)) {
		ansiStyles.dim.open = '';
	}

	while (i--) {
		var code = ansiStyles[nestedStyles[i]];

		// Replace any instances already present with a re-opening code
		// otherwise only the part of the string until said closing code
		// will be colored, and the rest will simply be 'plain'.
		str = code.open + str.replace(code.closeRe, code.open) + code.close;
	}

	// Reset the original 'dim' if we changed it to work around the Windows dimmed gray issue.
	ansiStyles.dim.open = originalDim;

	return str;
}

function init() {
	var ret = {};

	Object.keys(styles).forEach(function (name) {
		ret[name] = {
			get: function () {
				return build.call(this, [name]);
			}
		};
	});

	return ret;
}

defineProps(Chalk.prototype, init());

module.exports = new Chalk();
module.exports.styles = ansiStyles;
module.exports.hasColor = hasAnsi;
module.exports.stripColor = stripAnsi;
module.exports.supportsColor = supportsColor;


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;

module.exports = function (str) {
	if (typeof str !== 'string') {
		throw new TypeError('Expected a string');
	}

	return str.replace(matchOperatorsRe, '\\$&');
};


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/* WEBPACK VAR INJECTION */(function(module) {

function assembleStyles () {
	var styles = {
		modifiers: {
			reset: [0, 0],
			bold: [1, 22], // 21 isn't widely supported and 22 does the same thing
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		colors: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],
			gray: [90, 39]
		},
		bgColors: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49]
		}
	};

	// fix humans
	styles.colors.grey = styles.colors.gray;

	Object.keys(styles).forEach(function (groupName) {
		var group = styles[groupName];

		Object.keys(group).forEach(function (styleName) {
			var style = group[styleName];

			styles[styleName] = group[styleName] = {
				open: '\u001b[' + style[0] + 'm',
				close: '\u001b[' + style[1] + 'm'
			};
		});

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	});

	return styles;
}

Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});

/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(10)(module)))

/***/ }),
/* 10 */
/***/ (function(module, exports) {

module.exports = function(module) {
	if (!module.webpackPolyfill) {
		module.deprecate = function() {};
		module.paths = [];
		// module.parent = undefined by default
		if (!module.children) module.children = [];
		Object.defineProperty(module, "loaded", {
			enumerable: true,
			get: function() {
				return module.l;
			}
		});
		Object.defineProperty(module, "id", {
			enumerable: true,
			get: function() {
				return module.i;
			}
		});
		module.webpackPolyfill = 1;
	}
	return module;
};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var ansiRegex = __webpack_require__(12)();

module.exports = function (str) {
	return typeof str === 'string' ? str.replace(ansiRegex, '') : str;
};


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

module.exports = function () {
	return /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g;
};


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var ansiRegex = __webpack_require__(12);
var re = new RegExp(ansiRegex().source); // remove the `g` flag
module.exports = re.test.bind(re);


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var argv = process.argv;

var terminator = argv.indexOf('--');
var hasFlag = function (flag) {
	flag = '--' + flag;
	var pos = argv.indexOf(flag);
	return pos !== -1 && (terminator !== -1 ? pos < terminator : true);
};

module.exports = (function () {
	if ('FORCE_COLOR' in process.env) {
		return true;
	}

	if (hasFlag('no-color') ||
		hasFlag('no-colors') ||
		hasFlag('color=false')) {
		return false;
	}

	if (hasFlag('color') ||
		hasFlag('colors') ||
		hasFlag('color=true') ||
		hasFlag('color=always')) {
		return true;
	}

	if (process.stdout && !process.stdout.isTTY) {
		return false;
	}

	if (process.platform === 'win32') {
		return true;
	}

	if ('COLORTERM' in process.env) {
		return true;
	}

	if (process.env.TERM === 'dumb') {
		return false;
	}

	if (/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
		return true;
	}

	return false;
})();


/***/ }),
/* 15 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const preserveCamelCase = string => {
	let isLastCharLower = false;
	let isLastCharUpper = false;
	let isLastLastCharUpper = false;

	for (let i = 0; i < string.length; i++) {
		const character = string[i];

		if (isLastCharLower && /[a-zA-Z]/.test(character) && character.toUpperCase() === character) {
			string = string.slice(0, i) + '-' + string.slice(i);
			isLastCharLower = false;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = true;
			i++;
		} else if (isLastCharUpper && isLastLastCharUpper && /[a-zA-Z]/.test(character) && character.toLowerCase() === character) {
			string = string.slice(0, i - 1) + '-' + string.slice(i - 1);
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = false;
			isLastCharLower = true;
		} else {
			isLastCharLower = character.toLowerCase() === character;
			isLastLastCharUpper = isLastCharUpper;
			isLastCharUpper = character.toUpperCase() === character;
		}
	}

	return string;
};

const camelCase = (input, options) => {
	if (!(typeof input === 'string' || Array.isArray(input))) {
		throw new TypeError('Expected the input to be `string | string[]`');
	}

	options = Object.assign({
		pascalCase: false
	}, options);

	const postProcess = x => options.pascalCase ? x.charAt(0).toUpperCase() + x.slice(1) : x;

	if (Array.isArray(input)) {
		input = input.map(x => x.trim())
			.filter(x => x.length)
			.join('-');
	} else {
		input = input.trim();
	}

	if (input.length === 0) {
		return '';
	}

	if (input.length === 1) {
		return options.pascalCase ? input.toUpperCase() : input.toLowerCase();
	}

	if (/^[a-z\d]+$/.test(input)) {
		return postProcess(input);
	}

	const hasUpperCase = input !== input.toLowerCase();

	if (hasUpperCase) {
		input = preserveCamelCase(input);
	}

	input = input
		.replace(/^[_.\- ]+/, '')
		.toLowerCase()
		.replace(/[_.\- ]+(\w|$)/g, (m, p1) => p1.toUpperCase());

	return postProcess(input);
};

module.exports = camelCase;
module.exports.default = camelCase;


/***/ }),
/* 17 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

const chalk = __webpack_require__(7);

function extractContent(text, paragraphs) {

    text = text.replace(/^[\t ]+|[\t ]+$/gm, ``);
    text = text.replace(/^\n+|\n+$/g, ``);
    text = text.replace(/\n(\n)?\n*/g, `$1`);

    if (paragraphs) {
      text = text.split(/\r\n|\r|\n/g).map(function (paragraph) {

        let bulletMatch = paragraph.match(/^[*-][\t ]+(.*)/);

        if (bulletMatch) {
          return bulletMatch[1].match(/(.{1,78})(?: |$)/g).map((line, index) => {
            return (index === 0 ? `- ` : `  `) + line;
          }).join('\n');
        } else {
          return paragraph.match(/(.{1,80})(?: |$)/g).join('\n');
        }

      }).join('\n\n');
    }

    text = text.replace(/(`+)((?:.|[\n])*?)\1/g, function ($0, $1, $2) {
        return chalk.cyan($1 + $2 + $1);
    });

    return text ? text + `\n` : ``;

}

exports.Command = class Command {

    constructor(clipanion, definition) {

        this.clipanion = clipanion;

        // An array with the command "path" (ie the words that are required to run the command)
        this.path = definition.path;

        // The category where this command belongs in the help
        this.category = null;

        // The command description, has displayed in the help
        this.description = null;

        // The command details, written when printing the usage of a specific command
        this.details = ``;

        // Various commands examples that can good introduction to figure out how to use the command
        this.examples = [];

        // Various flag that affect how the command is seen by the controller
        this.defaultCommand = this.path.length === 0;
        this.hiddenCommand = false;
        this.proxyArguments = false;

        // A list of the names of the required arguments
        this.requiredArguments = definition.requiredArguments;

        // A list of the names of the optional arguments
        this.optionalArguments = definition.optionalArguments;

        // The name of the spread
        this.spread = definition.spread;

        // A list of all the options supported by the command
        this.options = definition.options;

        // A Joi validator, or null if this command doesn't use any validation
        this.validator = null;

        // The function that will be called when running the command
        this.run = () => {};

    }

    alias(pattern) {

        this.clipanion.command(`${pattern} [... rest]`)

            .flags({

                // Alias must not be displayed as regular commands
                hiddenCommand: true,

                // Alias directly forward all of their arguments to the actual command
                proxyArguments: true,

            })

            .action(args => this.clipanion.run(args.argv0, [
                ... this.path,
                ... args.rest,
            ]))

        ;

    }

    aliases(... patterns) {

        for (let pattern of patterns)
            this.alias(pattern);

        return this;

    }

    flags(flags) {

        Object.assign(this, flags);

        return this;

    }

    validate(validator) {

        this.validator = validator;

        return this;

    }

    categorize(category) {

        this.category = extractContent(category, false);

        return this;

    }

    describe(description) {

        this.description = extractContent(description, false);

        return this;

    }

    detail(details) {

        this.details = extractContent(details, true);

        return this;

    }

    example(description, example) {

        this.examples.push({
            description: extractContent(description, true),
            example: extractContent(example, false),
        });

        return this;

    }

    action(action) {

        this.run = action;

        return this;

    }

    check(topLevelNames) {

        let shortNames = this.options.map(option => option.shortName).filter(name => name);
        let longNames = this.options.map(option => option.longName).filter(name => name);

        let localNames = [].concat(shortNames, longNames, this.requiredArguments, this.optionalArguments);

        if (new Set(localNames).size !== localNames.length)
            throw new Error(`Some parameter names used inside a same command are conflicting together`);

        let allNames = localNames.concat(topLevelNames);

        if (new Set(allNames).size !== allNames.length) {
            throw new Error(`Some parameter names from a command are conflicting with the top-level parameters`);
        }

    }

};


/***/ }),
/* 19 */
/***/ (function(module, exports) {

exports.getOptionComponent = function getOptionString(options) {

    let components = [];

    for (let option of options) {

        if (option.hidden)
            continue;

        let names = [];

        if (option.shortName)
            names.push(`-${option.shortName}`);

        if (option.longName) {
            if (option.initialValue !== true) {
                names.push(`--${option.longName}`);
            } else if (option.longName.startsWith(`with-`)) {
                names.push(`--without-${option.longName.replace(/^with-/, ``)}`);
            } else {
                names.push(`--no-${option.longName}`);
            }
        }

        if (option.argumentName) {
            components.push(`[${names.join(`,`)} ${option.argumentName}]`);
        } else {
            components.push(`[${names.join(`,`)}]`);
        }

    }

    return components.join(` `);

};

exports.getUsageLine = function getUsageLine(command) {

    let components = [];

    for (const name of command.requiredArguments)
        components.push(`<${name}>`);

    for (const name of command.optionalArguments)
        components.push(`[${name}]`);

    if (command.spread)
        components.push(`[... ${command.spread}]`);

    let optionComponent = exports.getOptionComponent(command.options);

    if (optionComponent.length !== 0)
        components.push(optionComponent);

    return components.join(` `);

};


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */



function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { main: peg$parsemain },
      peg$startRuleFunction  = peg$parsemain,

      peg$c0 = function(command, options) { return Object.assign({}, command, options) },
      peg$c1 = function(path, requiredArguments, optionalArguments) { return Object.assign({}, path, requiredArguments, optionalArguments) },
      peg$c2 = function(initial, part) { return part },
      peg$c3 = function(initial, rest) { return { path: [ initial, ... rest ] } },
      peg$c4 = "",
      peg$c5 = function() { return { path: [] } },
      peg$c6 = function(name) { return name },
      peg$c7 = function(initial, rest) { return { requiredArguments: [ initial, ... rest ] } },
      peg$c8 = function() { return { requiredArguments: [] } },
      peg$c9 = "<",
      peg$c10 = peg$literalExpectation("<", false),
      peg$c11 = ">",
      peg$c12 = peg$literalExpectation(">", false),
      peg$c13 = function(spread) { return { optionalArguments: [], spread } },
      peg$c14 = function(initial, rest) { return { optionalArguments: [ initial, ... rest ], spread: null } },
      peg$c15 = function() { return { optionalArguments: [], spread: null } },
      peg$c16 = "[",
      peg$c17 = peg$literalExpectation("[", false),
      peg$c18 = "]",
      peg$c19 = peg$literalExpectation("]", false),
      peg$c20 = "[...",
      peg$c21 = peg$literalExpectation("[...", false),
      peg$c22 = function(initial, rest) { return { options: initial.concat(... rest) } },
      peg$c23 = function() { return { options: [] } },
      peg$c24 = "[-",
      peg$c25 = peg$literalExpectation("[-", false),
      peg$c26 = function(names) { return names.map(shortName => Object.assign({}, shortName, { longName: null, argumentName: null })) },
      peg$c27 = "...]",
      peg$c28 = peg$literalExpectation("...]", false),
      peg$c29 = function(names, argumentName) { return [ Object.assign({}, names, { argumentName, initialValue: [] }) ] },
      peg$c30 = function(names, argumentName) { return [ Object.assign({}, names, { argumentName, initialValue: undefined }) ] },
      peg$c31 = "?]",
      peg$c32 = peg$literalExpectation("?]", false),
      peg$c33 = function(names) { return [ Object.assign({}, names, { argumentName: null, initialValue: null }) ] },
      peg$c34 = function(names) { return [ Object.assign({}, names, { argumentName: null }) ] },
      peg$c35 = "-",
      peg$c36 = peg$literalExpectation("-", false),
      peg$c37 = ",-",
      peg$c38 = peg$literalExpectation(",-", false),
      peg$c39 = function(shortName) { return text() },
      peg$c40 = function(shortName, repeat) { return repeat },
      peg$c41 = ",--",
      peg$c42 = peg$literalExpectation(",--", false),
      peg$c43 = function(shortName, repeats, longName) { return longName },
      peg$c44 = function(shortName, repeats, longName) { return repeats.every((repeat, index) => repeat === shortName.shortName.repeat(2 + index)) },
      peg$c45 = function(shortName, repeats, longName) { return Object.assign({}, shortName, longName, { initialValue: 0, maxValue: 1 + repeats.length }) },
      peg$c46 = function(shortName, longName) { return Object.assign({}, shortName, longName) },
      peg$c47 = function(shortName) { return Object.assign({}, shortName, { longName: null }) },
      peg$c48 = "--",
      peg$c49 = peg$literalExpectation("--", false),
      peg$c50 = function(longName) { return Object.assign({}, longName, { shortName: null }) },
      peg$c51 = /^[a-zA-Z]/,
      peg$c52 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false),
      peg$c53 = function(shortName) { return { shortName, initialValue: false } },
      peg$c54 = "no-",
      peg$c55 = peg$literalExpectation("no-", false),
      peg$c56 = function(longName) { return { longName, initialValue: true } },
      peg$c57 = "without-",
      peg$c58 = peg$literalExpectation("without-", false),
      peg$c59 = function(longName) { return { longName: `with-${longName}`, initialValue: true } },
      peg$c60 = function(longName) { return { longName, initialValue: false } },
      peg$c61 = /^[A-Z]/,
      peg$c62 = peg$classExpectation([["A", "Z"]], false, false),
      peg$c63 = /^[A-Z0-9]/,
      peg$c64 = peg$classExpectation([["A", "Z"], ["0", "9"]], false, false),
      peg$c65 = function() { return text() },
      peg$c66 = "_",
      peg$c67 = peg$literalExpectation("_", false),
      peg$c68 = /^[a-z]/,
      peg$c69 = peg$classExpectation([["a", "z"]], false, false),
      peg$c70 = /^[a-z0-9]/,
      peg$c71 = peg$classExpectation([["a", "z"], ["0", "9"]], false, false),
      peg$c72 = /^[ ]/,
      peg$c73 = peg$classExpectation([" "], false, false),

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parsemain() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseS();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseS();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsecommand();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseS();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parseS();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseoptionList();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parseS();
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$parseS();
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c0(s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecommand() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseS();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseS();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsecommandPath();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseS();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parseS();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parserequiredArgumentList();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parseS();
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$parseS();
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parseoptionalArgumentList();
              if (s6 !== peg$FAILED) {
                s7 = [];
                s8 = peg$parseS();
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  s8 = peg$parseS();
                }
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c1(s2, s4, s6);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecommandPath() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsecommandPart();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = [];
      s5 = peg$parseS();
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$parseS();
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsecommandPart();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s3;
          s4 = peg$c2(s1, s5);
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseS();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseS();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parsecommandPart();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s3;
            s4 = peg$c2(s1, s5);
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c3(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$c4;
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c5();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsecommandPart() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parseidentifier();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c6(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parserequiredArgumentList() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parserequiredArgument();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = [];
      s5 = peg$parseS();
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$parseS();
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parserequiredArgument();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s3;
          s4 = peg$c2(s1, s5);
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseS();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseS();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parserequiredArgument();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s3;
            s4 = peg$c2(s1, s5);
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c7(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$c4;
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c8();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parserequiredArgument() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 60) {
      s1 = peg$c9;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c10); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseidentifier();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 62) {
          s3 = peg$c11;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c12); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c6(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoptionalArgumentList() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseoptionalSpread();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c13(s1);
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseoptionalArgument();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseS();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseS();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseoptionalArgument();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s3;
            s4 = peg$c2(s1, s5);
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = [];
          s5 = peg$parseS();
          if (s5 !== peg$FAILED) {
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = peg$parseS();
            }
          } else {
            s4 = peg$FAILED;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseoptionalArgument();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s3;
              s4 = peg$c2(s1, s5);
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c14(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$c4;
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c15();
        }
        s0 = s1;
      }
    }

    return s0;
  }

  function peg$parseoptionalArgument() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 91) {
      s1 = peg$c16;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c17); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseidentifier();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 93) {
          s3 = peg$c18;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c19); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c6(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoptionalSpread() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4) === peg$c20) {
      s1 = peg$c20;
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c21); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseS();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parseS();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseidentifier();
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 93) {
            s4 = peg$c18;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c19); }
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c6(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoptionList() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseoption();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = [];
      s5 = peg$parseS();
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = peg$parseS();
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseoption();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s3;
          s4 = peg$c2(s1, s5);
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseS();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseS();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseoption();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s3;
            s4 = peg$c2(s1, s5);
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c22(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$c4;
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c23();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseoption() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c24) {
      s1 = peg$c24;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c25); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parseshortOptionName();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseshortOptionName();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 93) {
          s3 = peg$c18;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c19); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c26(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 91) {
        s1 = peg$c16;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c17); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseoptionNames();
        if (s2 !== peg$FAILED) {
          s3 = [];
          s4 = peg$parseS();
          if (s4 !== peg$FAILED) {
            while (s4 !== peg$FAILED) {
              s3.push(s4);
              s4 = peg$parseS();
            }
          } else {
            s3 = peg$FAILED;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parseoptionArgument();
            if (s4 !== peg$FAILED) {
              s5 = [];
              s6 = peg$parseS();
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$parseS();
              }
              if (s5 !== peg$FAILED) {
                if (input.substr(peg$currPos, 4) === peg$c27) {
                  s6 = peg$c27;
                  peg$currPos += 4;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c28); }
                }
                if (s6 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c29(s2, s4);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 91) {
          s1 = peg$c16;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c17); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseoptionNames();
          if (s2 !== peg$FAILED) {
            s3 = [];
            s4 = peg$parseS();
            if (s4 !== peg$FAILED) {
              while (s4 !== peg$FAILED) {
                s3.push(s4);
                s4 = peg$parseS();
              }
            } else {
              s3 = peg$FAILED;
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parseoptionArgument();
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 93) {
                  s5 = peg$c18;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c19); }
                }
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c30(s2, s4);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 91) {
            s1 = peg$c16;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c17); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parseoptionNamesNoRepeat();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c31) {
                s3 = peg$c31;
                peg$currPos += 2;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c32); }
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c33(s2);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 91) {
              s1 = peg$c16;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c17); }
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseoptionNames();
              if (s2 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 93) {
                  s3 = peg$c18;
                  peg$currPos++;
                } else {
                  s3 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c19); }
                }
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c34(s2);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseoptionNames() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c35;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c36); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseshortOptionName();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c37) {
          s5 = peg$c37;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c38); }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$currPos;
          s7 = [];
          s8 = peg$parseshortOptionName();
          if (s8 !== peg$FAILED) {
            while (s8 !== peg$FAILED) {
              s7.push(s8);
              s8 = peg$parseshortOptionName();
            }
          } else {
            s7 = peg$FAILED;
          }
          if (s7 !== peg$FAILED) {
            peg$savedPos = s6;
            s7 = peg$c39(s2);
          }
          s6 = s7;
          if (s6 !== peg$FAILED) {
            peg$savedPos = s4;
            s5 = peg$c40(s2, s6);
            s4 = s5;
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c37) {
              s5 = peg$c37;
              peg$currPos += 2;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c38); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$currPos;
              s7 = [];
              s8 = peg$parseshortOptionName();
              if (s8 !== peg$FAILED) {
                while (s8 !== peg$FAILED) {
                  s7.push(s8);
                  s8 = peg$parseshortOptionName();
                }
              } else {
                s7 = peg$FAILED;
              }
              if (s7 !== peg$FAILED) {
                peg$savedPos = s6;
                s7 = peg$c39(s2);
              }
              s6 = s7;
              if (s6 !== peg$FAILED) {
                peg$savedPos = s4;
                s5 = peg$c40(s2, s6);
                s4 = s5;
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          if (input.substr(peg$currPos, 3) === peg$c41) {
            s5 = peg$c41;
            peg$currPos += 3;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c42); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parselongOptionName();
            if (s6 !== peg$FAILED) {
              peg$savedPos = s4;
              s5 = peg$c43(s2, s3, s6);
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = peg$currPos;
            s5 = peg$c44(s2, s3, s4);
            if (s5) {
              s5 = void 0;
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c45(s2, s3, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseoptionNamesNoRepeat();
    }

    return s0;
  }

  function peg$parseoptionNamesNoRepeat() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c35;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c36); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseshortOptionName();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c41) {
          s3 = peg$c41;
          peg$currPos += 3;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parselongOptionName();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c46(s2, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 45) {
        s1 = peg$c35;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c36); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseshortOptionName();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c47(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c48) {
          s1 = peg$c48;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c49); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parselongOptionName();
          if (s2 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c50(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parseshortOptionName() {
    var s0, s1;

    s0 = peg$currPos;
    if (peg$c51.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c52); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c53(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parselongOptionName() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c54) {
      s1 = peg$c54;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c55); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseidentifier();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c56(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8) === peg$c57) {
        s1 = peg$c57;
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c58); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseidentifier();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c59(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseidentifier();
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c60(s1);
        }
        s0 = s1;
      }
    }

    return s0;
  }

  function peg$parseoptionArgument() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    if (peg$c61.test(input.charAt(peg$currPos))) {
      s1 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c62); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c63.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c64); }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (peg$c63.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c64); }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 45) {
          s5 = peg$c35;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c36); }
        }
        if (s5 !== peg$FAILED) {
          if (peg$c61.test(input.charAt(peg$currPos))) {
            s6 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c62); }
          }
          if (s6 !== peg$FAILED) {
            s7 = [];
            if (peg$c63.test(input.charAt(peg$currPos))) {
              s8 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c64); }
            }
            while (s8 !== peg$FAILED) {
              s7.push(s8);
              if (peg$c63.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c64); }
              }
            }
            if (s7 !== peg$FAILED) {
              s5 = [s5, s6, s7];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 45) {
            s5 = peg$c35;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c36); }
          }
          if (s5 !== peg$FAILED) {
            if (peg$c61.test(input.charAt(peg$currPos))) {
              s6 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c62); }
            }
            if (s6 !== peg$FAILED) {
              s7 = [];
              if (peg$c63.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c64); }
              }
              while (s8 !== peg$FAILED) {
                s7.push(s8);
                if (peg$c63.test(input.charAt(peg$currPos))) {
                  s8 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s8 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c64); }
                }
              }
              if (s7 !== peg$FAILED) {
                s5 = [s5, s6, s7];
                s4 = s5;
              } else {
                peg$currPos = s4;
                s4 = peg$FAILED;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c65();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseidentifier() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 95) {
      s1 = peg$c66;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c67); }
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      if (peg$c68.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c69); }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        if (peg$c70.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c71); }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          if (peg$c70.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c71); }
          }
        }
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 45) {
            s6 = peg$c35;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c36); }
          }
          if (s6 !== peg$FAILED) {
            if (peg$c68.test(input.charAt(peg$currPos))) {
              s7 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c69); }
            }
            if (s7 !== peg$FAILED) {
              s8 = [];
              if (peg$c70.test(input.charAt(peg$currPos))) {
                s9 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s9 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c71); }
              }
              while (s9 !== peg$FAILED) {
                s8.push(s9);
                if (peg$c70.test(input.charAt(peg$currPos))) {
                  s9 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s9 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c71); }
                }
              }
              if (s8 !== peg$FAILED) {
                s6 = [s6, s7, s8];
                s5 = s6;
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 45) {
              s6 = peg$c35;
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c36); }
            }
            if (s6 !== peg$FAILED) {
              if (peg$c68.test(input.charAt(peg$currPos))) {
                s7 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s7 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c69); }
              }
              if (s7 !== peg$FAILED) {
                s8 = [];
                if (peg$c70.test(input.charAt(peg$currPos))) {
                  s9 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s9 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c71); }
                }
                while (s9 !== peg$FAILED) {
                  s8.push(s9);
                  if (peg$c70.test(input.charAt(peg$currPos))) {
                    s9 = input.charAt(peg$currPos);
                    peg$currPos++;
                  } else {
                    s9 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c71); }
                  }
                }
                if (s8 !== peg$FAILED) {
                  s6 = [s6, s7, s8];
                  s5 = s6;
                } else {
                  peg$currPos = s5;
                  s5 = peg$FAILED;
                }
              } else {
                peg$currPos = s5;
                s5 = peg$FAILED;
              }
            } else {
              peg$currPos = s5;
              s5 = peg$FAILED;
            }
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c65();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseS() {
    var s0;

    if (peg$c72.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c73); }
    }

    return s0;
  }

  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};


/***/ }),
/* 21 */
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
const core_1 = __webpack_require__(2);
const fslib_1 = __webpack_require__(3);
const path_1 = __webpack_require__(17);
const stageUtils = __importStar(__webpack_require__(22));
const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;
async function genCommitMessage(cwd) {
    const { stdout } = await core_1.execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], { cwd, strict: true });
    const lines = stdout.split(/\n/g).filter(line => line !== ``);
    return stageUtils.genCommitMessage(lines);
}
exports.Driver = {
    async findRoot(cwd) {
        return await stageUtils.findVcsRoot(cwd, { marker: `.git` });
    },
    async filterChanges(cwd, yarnRoots, yarnNames) {
        const { stdout } = await core_1.execUtils.execvp(`git`, [`status`, `-s`], { cwd, strict: true });
        const lines = stdout.toString().split(/\n/g);
        const changes = [].concat(...lines.map(line => {
            if (line === ``)
                return [];
            const path = path_1.posix.resolve(cwd, line.slice(3));
            // New directories need to be expanded to their content
            if (line.startsWith(`?? `) && line.endsWith(`/`)) {
                return stageUtils.expandDirectory(path);
            }
            else {
                return [path];
            }
        }));
        return changes.filter(path => {
            return stageUtils.isYarnFile(path, {
                roots: yarnRoots,
                names: yarnNames,
            });
        });
    },
    async makeCommit(cwd, changeList) {
        const localPaths = changeList.map(path => fslib_1.NodeFS.fromPortablePath(path));
        await core_1.execUtils.execvp(`git`, [`add`, `-N`, `--`, ...localPaths], { cwd, strict: true });
        await core_1.execUtils.execvp(`git`, [`commit`, `-m`, `${await genCommitMessage(cwd)}\n\n${MESSAGE_MARKER}\n`, `--`, ...localPaths], { cwd, strict: true });
    },
    async makeReset(cwd, changeList) {
        const localPaths = changeList.map(path => fslib_1.NodeFS.fromPortablePath(path));
        await core_1.execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ...localPaths], { cwd, strict: true });
    },
};


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const fslib_1 = __webpack_require__(3);
const path_1 = __webpack_require__(17);
async function findVcsRoot(cwd, { marker }) {
    do {
        if (!fslib_1.xfs.existsSync(`${cwd}/${marker}`)) {
            cwd = path_1.posix.dirname(cwd);
        }
        else {
            return cwd;
        }
    } while (cwd !== `/`);
    return null;
}
exports.findVcsRoot = findVcsRoot;
function isYarnFile(path, { roots, names }) {
    if (names.has(path_1.posix.basename(path)))
        return true;
    do {
        if (!roots.has(path)) {
            path = path_1.posix.dirname(path);
        }
        else {
            return true;
        }
    } while (path !== `/`);
    return false;
}
exports.isYarnFile = isYarnFile;
function expandDirectory(initialCwd) {
    const paths = [];
    const cwds = [initialCwd];
    while (cwds.length > 0) {
        const cwd = cwds.pop();
        const listing = fslib_1.xfs.readdirSync(cwd);
        for (const entry of listing) {
            const path = path_1.posix.resolve(cwd, entry);
            const stat = fslib_1.xfs.lstatSync(path);
            if (stat.isDirectory()) {
                cwds.push(path);
            }
            else {
                paths.push(path);
            }
        }
    }
    return paths;
}
exports.expandDirectory = expandDirectory;
function checkConsensus(lines, regex) {
    let yes = 0, no = 0;
    for (const line of lines) {
        if (regex.test(line)) {
            yes += 1;
        }
        else {
            no += 1;
        }
    }
    return yes >= no;
}
exports.checkConsensus = checkConsensus;
function findConsensus(lines) {
    const useThirdPerson = checkConsensus(lines, /^(\w\(\w+\):\s*)?\w+s/);
    const useUpperCase = checkConsensus(lines, /^(\w\(\w+\):\s*)?[A-Z]/);
    const useComponent = checkConsensus(lines, /^\w\(\w+\):/);
    return {
        useThirdPerson,
        useUpperCase,
        useComponent,
    };
}
exports.findConsensus = findConsensus;
function genCommitMessage(lines) {
    const { useThirdPerson, useUpperCase, useComponent, } = findConsensus(lines);
    const prefix = useComponent
        ? `chore(yarn): `
        : ``;
    const verb = useThirdPerson
        ? useUpperCase
            ? `Updates`
            : `updates`
        : useUpperCase
            ? `Update`
            : `update`;
    return `${prefix}${verb} the project settings`;
}
exports.genCommitMessage = genCommitMessage;


/***/ }),
/* 23 */
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
const stageUtils = __importStar(__webpack_require__(22));
exports.Driver = {
    async findRoot(cwd) {
        return await stageUtils.findVcsRoot(cwd, { marker: `.hg` });
    },
    async filterChanges(cwd, paths, filenames) {
        return [];
    },
    async makeCommit(cwd, changeList) {
    },
    async makeReset(cwd, changeList) {
    },
    async makeUpdate(cwd, changeList) {
    },
};


/***/ })
/******/ ]);
                      return plugin;
                    };

                    module.exports.name = "@berry/plugin-stage";
                  