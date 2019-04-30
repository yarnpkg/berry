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
const fs_1 = __importDefault(__webpack_require__(1));
const os_1 = __importDefault(__webpack_require__(2));
const path_1 = __importDefault(__webpack_require__(3));
const NodePathResolver_1 = __webpack_require__(4);
const PnPApiLoader_1 = __webpack_require__(5);
const PnPApiLocator_1 = __webpack_require__(8);
const VirtualDirReader_1 = __webpack_require__(9);
function mountVirtualNodeModulesFs() {
    const realFs = {};
    const fsMethods = Object.keys(fs_1.default).filter(function (key) {
        return key[0] === key[0].toLowerCase() && typeof fs_1.default[key] === 'function';
    });
    fsMethods.forEach(function (method) {
        realFs[method] = fs_1.default[method];
        fs_1.default[method] = fsProxy.bind({ method: method });
    });
    const apiLoader = new PnPApiLoader_1.PnPApiLoader({ watch: realFs.watch.bind(fs_1.default) });
    const pathResolver = new NodePathResolver_1.NodePathResolver({
        apiLoader,
        apiLocator: new PnPApiLocator_1.PnPApiLocator({ existsSync: fs_1.default.existsSync.bind(fs_1.default) })
    });
    const dirReader = new VirtualDirReader_1.VirtualDirReader();
    function fsProxy() {
        const args = Array.prototype.slice.call(arguments);
        let hasResult = false;
        let result;
        try {
            if (['accessSync', 'existsSync', 'stat', 'statSync'].indexOf(this.method) >= 0) {
                const pnpPath = pathResolver.resolvePath(args[0]);
                if (pnpPath.apiPath) {
                    let fileMightExist = true;
                    if (pnpPath.resolvedPath === null) {
                        fileMightExist = false;
                    }
                    else if (pnpPath.resolvedPath === undefined) {
                        if (dirReader.readDir(pnpPath) === null) {
                            fileMightExist = false;
                        }
                        else {
                            args[0] = pnpPath.issuer;
                        }
                    }
                    else {
                        args[0] = pnpPath.resolvedPath;
                    }
                    if (!fileMightExist) {
                        if (['existsSync'].indexOf(this.method) >= 0)
                            result = false;
                        else if (['stat'].indexOf(this.method) < 0)
                            result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
                        hasResult = true;
                    }
                }
            }
            else if (['realpathSync'].indexOf(this.method) >= 0) {
                const pnpPath = pathResolver.resolvePath(args[0]);
                if (pnpPath.apiPath) {
                    if (pnpPath.resolvedPath) {
                        args[0] = pnpPath.resolvedPath;
                    }
                    else if (pnpPath.resolvedPath === undefined) {
                        if (dirReader.readDir(pnpPath) !== null)
                            result = args[0];
                        else
                            result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
                        hasResult = true;
                    }
                    else if (pnpPath.resolvedPath === null) {
                        result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
                        hasResult = true;
                    }
                }
            }
            else if (['readFileSync'].indexOf(this.method) >= 0) {
                const pnpPath = pathResolver.resolvePath(args[0]);
                if (pnpPath.apiPath) {
                    if (!pnpPath.resolvedPath) {
                        result = new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
                        hasResult = true;
                    }
                    else {
                        args[0] = pnpPath.resolvedPath;
                    }
                }
            }
            else if (['readdirSync'].indexOf(this.method) >= 0) {
                const pnpPath = pathResolver.resolvePath(args[0]);
                if (pnpPath.apiPath) {
                    if (pnpPath.resolvedPath === null) {
                        result = new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
                        hasResult = true;
                    }
                    else if (pnpPath.resolvedPath === undefined) {
                        const dirList = dirReader.readDir(pnpPath);
                        if (dirList === null) {
                            result = new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
                            hasResult = true;
                        }
                        else {
                            result = dirList;
                            hasResult = true;
                        }
                    }
                    else {
                        args[0] = pnpPath.resolvedPath;
                    }
                }
            }
        }
        catch (e) {
            realFs.appendFileSync.apply(fs_1.default, [path_1.default.join(os_1.default.tmpdir(), 'pnpify.log'), e.stack + '\n']);
        }
        try {
            if (hasResult && result instanceof Error)
                throw result;
            const finalResult = hasResult ? result : realFs[this.method].apply(fs_1.default, args);
            if (process.env.PNPIFY_TRACE && arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0) {
                const dumpedResult = this.method === 'watch' || finalResult === undefined ? '' : ' = ' + JSON.stringify(finalResult instanceof Buffer ? finalResult.toString() : finalResult);
                realFs.appendFileSync.apply(fs_1.default, [path_1.default.join(os_1.default.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] + ' -> ' + args[0] + dumpedResult + '\n']);
            }
            return finalResult;
        }
        catch (e) {
            if (process.env.PNPIFY_TRACE && arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0)
                realFs.appendFileSync.apply(fs_1.default, [path_1.default.join(os_1.default.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] + ' -> ' + args[0] + ' = ' + ((e.message.indexOf('ENOENT') >= 0 || e.message.indexOf('ENOTDIR') >= 0) ? e.message : e.stack) + '\n']);
            throw e;
        }
    }
}
mountVirtualNodeModulesFs();


/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("os");

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Regexp for pathname that catches the following paths:
 *
 * 1. A path without `/node_modules` in the beginning. We don't process these, since they cannot be inside any of PnP package roots
 * 2. A path with incomplete or complete package name inside, e.g. `/node_modules[/@scope][/foo]`
 *
 * And everything at the end of the pathname
 */
const NODE_MODULES_REGEXP = /(?:\/node_modules((?:\/@[^\/]+)?(?:\/[^@][^\/]+)?))?(.*)/;
/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
class NodePathResolver {
    /**
     * Constructs new instance of Node path resolver
     *
     * @param options optional Node path resolver options
     */
    constructor(options) {
        this.options = options;
    }
    getIssuer(pnp, pathname) {
        const locator = pnp.findPackageLocator(pathname + '/');
        const info = locator && pnp.getPackageInformation(locator);
        return !info ? undefined : info.packageLocation;
    }
    /**
     * Resolves paths containing `/node_modules` inside PnP projects. If path is outside PnP
     * project it is not changed.
     *
     * This method extracts `.../node_modules/pkgName/...` from the path
     * and uses previous package as an issuer for the next package.
     *
     * @param nodePath path containing `node_modules`
     *
     * @returns resolved path
     */
    resolvePath(nodePath) {
        const pathname = nodePath.replace('\\', '/');
        const result = { resolvedPath: nodePath };
        if (pathname.indexOf('/node_modules') < 0)
            // Non-node_modules paths should not be processed
            return result;
        const pnpApiPath = this.options.apiLocator.findApi(nodePath);
        result.apiPath = pnpApiPath;
        const pnp = pnpApiPath && this.options.apiLoader.getApi(pnpApiPath);
        if (pnpApiPath && pnp) {
            // Extract first issuer from the path using PnP API
            let issuer = this.getIssuer(pnp, pathname);
            let request;
            // If we have something left in a path to parse, do that
            if (issuer && pathname.length > issuer.length) {
                request = pathname.substring(issuer.length);
                let m;
                let pkgName;
                let partialPackageName = false;
                do {
                    m = request.match(NODE_MODULES_REGEXP);
                    if (m) {
                        [, pkgName, request] = m;
                        // Strip starting /
                        pkgName = pkgName ? pkgName.substring(1) : pkgName;
                        // Check if full package name was provided
                        if (pkgName) {
                            if (pkgName[0] !== '@' || pkgName.indexOf('/') > 0) {
                                try {
                                    const res = pnp.resolveToUnqualified(pkgName, issuer + '/');
                                    issuer = res === null || res === issuer ? undefined : res;
                                }
                                catch (e) {
                                    issuer = undefined;
                                    break;
                                }
                            }
                            else {
                                request = pkgName;
                                pkgName = undefined;
                                partialPackageName = true;
                            }
                        }
                    }
                    // Continue parsing path remainder until we have something left in a `request`
                    // and we still have not lost the issuer
                } while (request && pkgName);
                if (issuer) {
                    if (partialPackageName) {
                        delete result.resolvedPath;
                        result.issuer = issuer;
                        result.apiPath = pnpApiPath;
                        result.request = request;
                        const locator = pnp.findPackageLocator(issuer + '/');
                        const pkgInfo = locator ? pnp.getPackageInformation(locator) : undefined;
                        result.issuerInfo = pkgInfo === null ? undefined : pkgInfo;
                    }
                    else {
                        result.resolvedPath = issuer + request;
                    }
                }
            }
            // If we don't have issuer here, it means the path cannot exist in PnP project
            if (!issuer) {
                result.resolvedPath = null;
            }
        }
        return result;
    }
}
exports.NodePathResolver = NodePathResolver;


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(__webpack_require__(6));
const dynamicRequire_1 = __webpack_require__(7);
/**
 * Loads PnP API from the PnP API path in a cached way, then
 * watches for changes to this file and if any - invalidates cache
 * and emits an event
 */
class PnPApiLoader extends events_1.default {
    /**
     * Constructs new instance of PnP API loader
     *
     * @param options optional loader options
     */
    constructor(options) {
        super();
        this.cachedApis = {};
        const opts = options || {};
        this.options = {
            uncachedRequire: opts.uncachedRequire || ((modulePath) => {
                delete __webpack_require__.c[dynamicRequire_1.dynamicRequire.resolve(modulePath)];
                return dynamicRequire_1.dynamicRequire(modulePath);
            }),
            watch: opts.watch
        };
    }
    /**
     * Requires and returns PnP API in a cached way and then
     * watches for PnP API file changes.
     *
     * If changes to PnP API file will be detected next call to this function
     * will reload PnP API afresh and returns it.
     *
     * On PnP API file change watch event will be emitted on this class
     *
     * @param pnpApiPath path to PnP API file
     *
     * @returns `pnpapi` instance for the given PnP API file
     */
    getApi(pnpApiPath) {
        const cacheEntry = this.cachedApis[pnpApiPath] || {};
        if (!cacheEntry.pnpApi) {
            cacheEntry.pnpApi = this.options.uncachedRequire(pnpApiPath);
            if (cacheEntry.pnpApi && !cacheEntry.watched) {
                cacheEntry.watched = true;
                this.cachedApis[pnpApiPath] = cacheEntry;
                this.options.watch(pnpApiPath, { persistent: false }, () => {
                    let newApi;
                    try {
                        newApi = this.options.uncachedRequire(pnpApiPath);
                    }
                    catch (e) {
                    }
                    /**
                     * Sometimes we receive empty API object here,
                     * we will ignore this event
                     */
                    if (newApi === undefined || (newApi && Object.keys(newApi).length > 0)) {
                        if (newApi !== undefined)
                            cacheEntry.pnpApi = newApi;
                        else
                            delete cacheEntry.pnpApi;
                        this.emit('change', pnpApiPath);
                    }
                });
            }
        }
        return cacheEntry.pnpApi;
    }
}
exports.PnPApiLoader = PnPApiLoader;


/***/ }),
/* 6 */
/***/ (function(module, exports) {

module.exports = require("events");

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const dynamicRequire =  true
    ? require
    : undefined;
exports.dynamicRequire = dynamicRequire;


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
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
            existsSync: opts.existsSync,
            pnpFileName: opts.pnpFileName || '.pnp.js'
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
        const pathComponentList = this.getPathComponents(sourcePath);
        let currentDir;
        let node = this.checkTree;
        for (const pathComponent of pathComponentList) {
            currentDir = typeof currentDir === 'undefined' ? pathComponent : currentDir + '/' + pathComponent;
            const currentPath = currentDir + '/' + this.options.pnpFileName;
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
exports.PnPApiLocator = PnPApiLocator;


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Virtual dirs reader for the dirs `/node_modules[/@foo][/bar]`.
 *
 * These dirs are special for emulation of `node_modules` dependencies on the filesystem,
 * because they either do not exist or even whey they exist, they should have modification
 * >= time of PnP API file.
 */
class VirtualDirReader {
    /**
     * Returns `readdir`-like result for partially resolved pnp path
     *
     * @param pnpPath partially resolved PnP path
     *
     * @returns `null` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
     */
    readDir(pnpPath) {
        if (pnpPath.issuer === undefined || pnpPath.request === undefined)
            return null;
        const result = [];
        if (pnpPath.issuerInfo) {
            for (const key of pnpPath.issuerInfo.packageDependencies.keys()) {
                const [scope, pkgName] = key.split('/');
                if (!pnpPath.request) {
                    if (result.indexOf(scope) < 0) {
                        result.push(scope);
                    }
                }
                else if (pnpPath.request === scope) {
                    result.push(pkgName);
                }
            }
        }
        return result.length === 0 ? null : result;
    }
}
exports.VirtualDirReader = VirtualDirReader;


/***/ })
/******/ ]);