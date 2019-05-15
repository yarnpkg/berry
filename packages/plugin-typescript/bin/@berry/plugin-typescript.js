
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
const core_1 = __webpack_require__(1);
const core_2 = __webpack_require__(1);
const plugin_essentials_1 = __webpack_require__(2);
const gen_sdk_1 = __importDefault(__webpack_require__(3));
const getTypesName = (descriptor) => {
    return descriptor.scope
        ? `${descriptor.scope}__${descriptor.name}`
        : `${descriptor.name}`;
};
const afterWorkspaceDependencyAddition = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`)
        return;
    const project = workspace.project;
    const configuration = project.configuration;
    const cache = await core_1.Cache.find(configuration);
    const typesName = getTypesName(descriptor);
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const modifier = plugin_essentials_1.suggestUtils.Modifier.EXACT;
    const strategies = [plugin_essentials_1.suggestUtils.Strategy.LATEST];
    const request = core_2.structUtils.makeDescriptor(core_2.structUtils.makeIdent(`types`, typesName), `unknown`);
    const suggestions = await plugin_essentials_1.suggestUtils.getSuggestedDescriptors(request, { workspace, project, cache, target, modifier, strategies });
    const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
    if (nonNullSuggestions.length === 0)
        return;
    const selected = nonNullSuggestions[0].descriptor;
    if (selected === null)
        return;
    workspace.manifest[target].set(selected.identHash, selected);
};
const afterWorkspaceDependencyRemoval = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`)
        return;
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const typesName = getTypesName(descriptor);
    const ident = core_2.structUtils.makeIdent(`types`, typesName);
    const current = workspace.manifest[target].get(ident.identHash);
    if (typeof current === `undefined`)
        return;
    workspace.manifest[target].delete(ident.identHash);
};
const beforeWorkspacePacking = (workspace, rawManifest) => {
    if (rawManifest.publishConfig && rawManifest.publishConfig.typings)
        rawManifest.typings = rawManifest.publishConfig.typings;
    if (rawManifest.publishConfig && rawManifest.publishConfig.types) {
        rawManifest.types = rawManifest.publishConfig.types;
    }
};
const plugin = {
    commands: [
        gen_sdk_1.default,
    ],
    hooks: {
        afterWorkspaceDependencyAddition,
        afterWorkspaceDependencyRemoval,
        beforeWorkspacePacking,
    },
};
// eslint-disable-next-line arca/no-default-export
exports.default = plugin;


/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("@berry/core");

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("@berry/plugin-essentials");

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = __webpack_require__(4);
const core_1 = __webpack_require__(1);
const fslib_1 = __webpack_require__(5);
const PNPIFY_IDENT = core_1.structUtils.makeIdent(`berry`, `pnpify`);
const TEMPLATE = [
    `// Locate the top-level PnP api\n`,
    `const {PnPApiLocator} = require('@berry/pnpify');\n`,
    `const pnpApiPath = new PnPApiLocator().findApi(__dirname);\n`,
    `\n`,
    `// If we don't find one, something is off\n`,
    `if (!pnpApiPath)\n`,
    `  throw new Error(\`Couldn't locate the PnP API to use with the SDK\`);\n`,
    `\n`,
    `// Setup the environment to be able to require @berry/pnpify\n`,
    `require(pnpApiPath).setup();\n`,
    `\n`,
    `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
    `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
    `process.env.NODE_OPTIONS += \` -r \${pnpApiPath}\`;\n`,
    `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@berry/pnpify\`)}\`;\n`,
    `\n`,
    `// Apply PnPify to the current process\n`,
    `require(\`@berry/pnpify\`).patchFs();\n`,
    `\n`,
    `// Defer to the real typescript your application uses\n`,
    `require(\`typescript/lib/tsserver\`);\n`,
].join(``);
// eslint-disable-next-line arca/no-default-export
exports.default = (clipanion, pluginConfiguration) => clipanion
    .command(`ts gen-sdk [path]`)
    .categorize(`TypeScript-related commands`)
    .describe(`generate a TS sdk compatible with vscode`)
    .detail(`
    This command generates a TypeScript SDK folder compatible with what VSCode expects to find in its \`typescript.sdk\` settings.

    The SDK folder (called \`tssdk\`) will by default be generated in the top-level folder of your project, but you can change this by specifying any other path as first and unique positional argument.
  `)
    .example(`Generate a \`tssdk\` folder in the default location`, `yarn ts gen-sdk`)
    .example(`Generate a \`tssdk\` folder in the \`scripts\` directory`, `yarn ts gen-sdk scripts`)
    .action(async ({ cwd, stdin, stdout, stderr, path }) => {
    const configuration = await core_1.Configuration.find(cwd, pluginConfiguration);
    const { project, workspace } = await core_1.Project.find(configuration, cwd);
    if (!workspace)
        throw new cli_1.WorkspaceRequiredError(cwd);
    const destination = path
        ? `${path}/tssdk`
        : `${project.cwd}/tssdk`;
    if (!project.topLevelWorkspace.manifest.hasHardDependency(PNPIFY_IDENT)) {
        const addExitCode = await clipanion.run(null, [`add`, `-D`, `--`, core_1.structUtils.stringifyIdent(PNPIFY_IDENT)], { cwd: project.cwd, stdin, stdout, stderr });
        if (addExitCode !== 0)
            return addExitCode;
        stdout.write(`\n`);
    }
    const report = await core_1.StreamReport.start({ configuration, stdout }, async (report) => {
        await fslib_1.xfs.removePromise(`${destination}`);
        await fslib_1.xfs.mkdirpPromise(`${destination}/lib`);
        await fslib_1.xfs.writeFilePromise(`${destination}/lib/tsserver.js`, TEMPLATE);
        report.reportInfo(core_1.MessageName.UNNAMED, `Generated the SDK in ${destination}`);
    });
    return report.exitCode();
});


/***/ }),
/* 4 */
/***/ (function(module, exports) {

module.exports = require("@berry/cli");

/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("@berry/fslib");

/***/ })
/******/ ]);
                      return plugin;
                    };

                    module.exports.name = "@berry/plugin-typescript";
                  