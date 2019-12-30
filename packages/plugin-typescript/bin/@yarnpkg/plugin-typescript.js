/* eslint-disable*/
module.exports = {
  name: "@yarnpkg/plugin-typescript",
  factory: function (require) {
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


  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(1);

  const core_2 = __webpack_require__(1);

  const plugin_essentials_1 = __webpack_require__(2);

  const getTypesName = descriptor => {
    return descriptor.scope ? `${descriptor.scope}__${descriptor.name}` : `${descriptor.name}`;
  };

  const afterWorkspaceDependencyAddition = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`) return;
    const project = workspace.project;
    const configuration = project.configuration;
    const cache = await core_1.Cache.find(configuration);
    const typesName = getTypesName(descriptor);
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const modifier = plugin_essentials_1.suggestUtils.Modifier.EXACT;
    const strategies = [plugin_essentials_1.suggestUtils.Strategy.LATEST];
    const request = core_2.structUtils.makeDescriptor(core_2.structUtils.makeIdent(`types`, typesName), `unknown`);
    const suggestions = await plugin_essentials_1.suggestUtils.getSuggestedDescriptors(request, {
      workspace,
      project,
      cache,
      target,
      modifier,
      strategies
    });
    const nonNullSuggestions = suggestions.filter(suggestion => suggestion.descriptor !== null);
    if (nonNullSuggestions.length === 0) return;
    const selected = nonNullSuggestions[0].descriptor;
    if (selected === null) return;
    workspace.manifest[target].set(selected.identHash, selected);
  };

  const afterWorkspaceDependencyRemoval = async (workspace, dependencyTarget, descriptor) => {
    if (descriptor.scope === `types`) return;
    const target = plugin_essentials_1.suggestUtils.Target.DEVELOPMENT;
    const typesName = getTypesName(descriptor);
    const ident = core_2.structUtils.makeIdent(`types`, typesName);
    const current = workspace.manifest[target].get(ident.identHash);
    if (typeof current === `undefined`) return;
    workspace.manifest[target].delete(ident.identHash);
  };

  const beforeWorkspacePacking = (workspace, rawManifest) => {
    if (rawManifest.publishConfig && rawManifest.publishConfig.typings) rawManifest.typings = rawManifest.publishConfig.typings;

    if (rawManifest.publishConfig && rawManifest.publishConfig.types) {
      rawManifest.types = rawManifest.publishConfig.types;
    }
  };

  const plugin = {
    hooks: {
      afterWorkspaceDependencyAddition,
      afterWorkspaceDependencyRemoval,
      beforeWorkspacePacking
    }
  }; // eslint-disable-next-line arca/no-default-export

  exports.default = plugin;

  /***/ }),
  /* 1 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 2 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/plugin-essentials");

  /***/ })
  /******/ ]);
    return plugin;
  },
};
