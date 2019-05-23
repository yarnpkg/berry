module.exports =
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
/******/ 	return __webpack_require__(__webpack_require__.s = 18);
/******/ })
/************************************************************************/
/******/ ({

/***/ 1:
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),

/***/ 18:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _PnPApiLocator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var _dynamicRequire__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);


process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''}-r ${_dynamicRequire__WEBPACK_IMPORTED_MODULE_1__[/* dynamicRequire */ "a"].resolve('.')}`;
const pnpApiPath = new _PnPApiLocator__WEBPACK_IMPORTED_MODULE_0__[/* PnPApiLocator */ "a"]().findApi(__dirname);
if (pnpApiPath) {
    process.mainModule.id = 'internal/preload';
    Object(_dynamicRequire__WEBPACK_IMPORTED_MODULE_1__[/* dynamicRequire */ "a"])(pnpApiPath);
    process.env.NODE_OPTIONS += ` -r ${pnpApiPath}`;
}
Object(_dynamicRequire__WEBPACK_IMPORTED_MODULE_1__[/* dynamicRequire */ "a"])('.').patchFs();
Object(_dynamicRequire__WEBPACK_IMPORTED_MODULE_1__[/* dynamicRequire */ "a"])('typescript/lib/tsserver');


/***/ }),

/***/ 3:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return dynamicRequire; });
const dynamicRequire =  true
    ? require
    : undefined;



/***/ }),

/***/ 6:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PnPApiLocator; });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);

/**
 * PnP API locator given arbitrary path answers the question is this path inside PnP project,
 * and if yes what is the path to PnP API file of this PnP project. If no - it returns null.
 *
 * PnP API locator tries to answer this question with minimal possible number of fs calls.
 *
 * Assumptions:
 *  - PnP project cannot be inside `node_modules`
 *  - PnP project cannot be inside other PnP project
 */
class PnPApiLocator {
    /**
     * Constructs new instance of PnP API locator
     *
     * @param options optional locator options
     */
    constructor(options) {
        const opts = options || {};
        this.options = {
            existsSync: opts.existsSync || fs__WEBPACK_IMPORTED_MODULE_0__["existsSync"].bind(fs__WEBPACK_IMPORTED_MODULE_0__),
            pnpFileName: opts.pnpFileName || '.pnp.js',
        };
        this.checkTree = new Map();
    }
    /**
     * Returns all the path components for given path.
     *
     * @param sourcePath path
     *
     * @returns path components
     */
    getPathComponents(sourcePath) {
        const normalizedPath = sourcePath.replace(/\\/g, '/').replace(/\/+$/, '');
        const idx = normalizedPath.indexOf('\/node_modules');
        return (idx >= 0 ? normalizedPath.substring(0, idx) : normalizedPath).split('/');
    }
    /**
     * Finds PnP API file path for the given `sourcePath`.
     *
     * @param sourcePath some directory that might be inside or outside PnP project
     *
     * @returns null if `sourcePath` is not inside PnP project, or PnP API file path otherwise
     */
    findApi(sourcePath) {
        let apiPath = null;
        const pathSep = sourcePath.indexOf('\\') >= 0 ? '\\' : '/';
        const pathComponentList = this.getPathComponents(sourcePath);
        let currentDir;
        let node = this.checkTree;
        for (const pathComponent of pathComponentList) {
            currentDir = typeof currentDir === 'undefined' ? pathComponent : currentDir + pathSep + pathComponent;
            let currentPath = currentDir + pathSep + this.options.pnpFileName;
            let val = node.get(pathComponent);
            if (typeof val === 'undefined') {
                val = this.options.existsSync(currentPath) ? true : new Map();
                node.set(pathComponent, val);
            }
            if (val === true) {
                apiPath = currentPath;
                break;
            }
            node = val;
        }
        return apiPath;
    }
    /**
     * Tells the locator that the given path and all child paths should be rechecked
     *
     * @param sourcePath path to invalidate, empty string invalidates all the paths
     */
    invalidatePath(sourcePath) {
        const pathComponentList = this.getPathComponents(sourcePath);
        let node = this.checkTree;
        for (const pathComponent of pathComponentList.slice(0, -1)) {
            node = node.get(pathComponent);
            if (typeof node === 'undefined') {
                break;
            }
        }
        if (typeof node !== 'undefined') {
            node.delete(pathComponentList[pathComponentList.length - 1]);
        }
    }
}


/***/ })

/******/ });