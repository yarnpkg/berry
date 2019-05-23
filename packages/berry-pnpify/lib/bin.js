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
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PortablePath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "d", function() { return npath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "e", function() { return ppath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "c", function() { return fromPortablePath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "g", function() { return toPortablePath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return convertPath; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "f", function() { return toFilename; });
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(5);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_0__);

const PortablePath = {
    root: `/`,
    dot: `.`,
};
const npath = path__WEBPACK_IMPORTED_MODULE_0___default.a;
const ppath = path__WEBPACK_IMPORTED_MODULE_0___default.a.posix;
const WINDOWS_PATH_REGEXP = /^[a-zA-Z]:.*$/;
const PORTABLE_PATH_REGEXP = /^\/[a-zA-Z]:.*$/;
// Path should look like "/N:/berry/scripts/plugin-pack.js"
// And transform to "N:\berry\scripts\plugin-pack.js"
function fromPortablePath(p) {
    if (process.platform !== 'win32')
        return p;
    return p.match(PORTABLE_PATH_REGEXP) ? p.substring(1).replace(/\//g, `\\`) : p;
}
// Path should look like "N:/berry/scripts/plugin-pack.js"
// And transform to "/N:/berry/scripts/plugin-pack.js"
function toPortablePath(p) {
    if (process.platform !== 'win32')
        return p;
    return (p.match(WINDOWS_PATH_REGEXP) ? `/${p}` : p).replace(/\\/g, `/`);
}
function convertPath(targetPathUtils, sourcePath) {
    return (targetPathUtils === npath ? fromPortablePath(sourcePath) : toPortablePath(sourcePath));
}
function toFilename(filename) {
    if (npath.parse(filename).dir !== '' || ppath.parse(filename).dir !== '')
        throw new Error(`Invalid filename: "${filename}"`);
    return filename;
}


/***/ }),
/* 1 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return patchFs; });
/* unused harmony export extendFs */
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return xfs; });
/* harmony import */ var _NodeFS__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(4);













function patchFs(patchedFs, fakeFs) {
    const SYNC_IMPLEMENTATIONS = new Set([
        `accessSync`,
        `createReadStream`,
        `chmodSync`,
        `copyFileSync`,
        `lstatSync`,
        `openSync`,
        `readlinkSync`,
        `readFileSync`,
        `readdirSync`,
        `readlinkSync`,
        `realpathSync`,
        `rmdirSync`,
        `statSync`,
        `symlinkSync`,
        `unlinkSync`,
        `utimesSync`,
        `writeFileSync`,
    ]);
    const ASYNC_IMPLEMENTATIONS = new Set([
        `accessPromise`,
        `chmodPromise`,
        `copyFilePromise`,
        `lstatPromise`,
        `openPromise`,
        `readdirPromise`,
        `realpathPromise`,
        `readFilePromise`,
        `readdirPromise`,
        `readlinkPromise`,
        `rmdirPromise`,
        `statPromise`,
        `symlinkPromise`,
        `unlinkPromise`,
        `utimesPromise`,
        `writeFilePromise`,
    ]);
    patchedFs.existsSync = (p) => {
        try {
            return fakeFs.existsSync(p);
        }
        catch (error) {
            return false;
        }
    };
    patchedFs.exists = (p, callback) => {
        fakeFs.existsPromise(p).then(result => {
            if (callback) {
                callback(result);
            }
        }, () => {
            if (callback) {
                callback(false);
            }
        });
    };
    for (const fnName of ASYNC_IMPLEMENTATIONS) {
        const fakeImpl = fakeFs[fnName].bind(fakeFs);
        const origName = fnName.replace(/Promise$/, ``);
        patchedFs[origName] = (...args) => {
            const hasCallback = typeof args[args.length - 1] === `function`;
            const callback = hasCallback ? args.pop() : () => { };
            fakeImpl(...args).then((result) => {
                callback(undefined, result);
            }, (error) => {
                callback(error);
            });
        };
    }
    for (const fnName of SYNC_IMPLEMENTATIONS) {
        const fakeImpl = fakeFs[fnName].bind(fakeFs);
        const origName = fnName;
        patchedFs[origName] = fakeImpl;
    }
    patchedFs.realpathSync.native = patchedFs.realpathSync;
    patchedFs.realpath.native = patchedFs.realpath;
}
function extendFs(realFs, fakeFs) {
    const patchedFs = Object.create(realFs);
    patchFs(patchedFs, fakeFs);
    return patchedFs;
}
const xfs = new _NodeFS__WEBPACK_IMPORTED_MODULE_0__[/* NodeFS */ "a"]();


/***/ }),
/* 2 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "b", function() { return FakeFS; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return BasePortableFakeFS; });
/* harmony import */ var _path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(0);


class FakeFS {
    constructor(pathUtils) {
        this.pathUtils = pathUtils;
    }
    async removePromise(p) {
        let stat;
        try {
            stat = await this.lstatPromise(p);
        }
        catch (error) {
            if (error.code === `ENOENT`) {
                return;
            }
            else {
                throw error;
            }
        }
        if (stat.isDirectory()) {
            for (const entry of await this.readdirPromise(p))
                await this.removePromise(this.pathUtils.resolve(p, entry));
            // 5 gives 1s worth of retries at worst
            for (let t = 0; t < 5; ++t) {
                try {
                    await this.rmdirPromise(p);
                    break;
                }
                catch (error) {
                    if (error.code === `EBUSY` || error.code === `ENOTEMPTY`) {
                        await new Promise(resolve => setTimeout(resolve, t * 100));
                        continue;
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        else {
            await this.unlinkPromise(p);
        }
    }
    removeSync(p) {
        let stat;
        try {
            stat = this.lstatSync(p);
        }
        catch (error) {
            if (error.code === `ENOENT`) {
                return;
            }
            else {
                throw error;
            }
        }
        if (stat.isDirectory()) {
            for (const entry of this.readdirSync(p))
                this.removeSync(this.pathUtils.resolve(p, entry));
            this.rmdirSync(p);
        }
        else {
            this.unlinkSync(p);
        }
    }
    async mkdirpPromise(p, { chmod, utimes } = {}) {
        p = this.resolve(p);
        if (p === this.pathUtils.dirname(p))
            return;
        const parts = p.split(this.pathUtils.sep);
        for (let u = 2; u <= parts.length; ++u) {
            const subPath = parts.slice(0, u).join(this.pathUtils.sep);
            if (!this.existsSync(subPath)) {
                try {
                    await this.mkdirPromise(subPath);
                }
                catch (error) {
                    if (error.code === `EEXIST`) {
                        continue;
                    }
                    else {
                        throw error;
                    }
                }
                if (chmod != null)
                    await this.chmodPromise(subPath, chmod);
                if (utimes != null) {
                    await this.utimesPromise(subPath, utimes[0], utimes[1]);
                }
            }
        }
    }
    mkdirpSync(p, { chmod, utimes } = {}) {
        p = this.resolve(p);
        if (p === this.pathUtils.dirname(p))
            return;
        const parts = p.split(this.pathUtils.sep);
        for (let u = 2; u <= parts.length; ++u) {
            const subPath = parts.slice(0, u).join(this.pathUtils.sep);
            if (!this.existsSync(subPath)) {
                try {
                    this.mkdirSync(subPath);
                }
                catch (error) {
                    if (error.code === `EEXIST`) {
                        continue;
                    }
                    else {
                        throw error;
                    }
                }
                if (chmod != null)
                    this.chmodSync(subPath, chmod);
                if (utimes != null) {
                    this.utimesSync(subPath, utimes[0], utimes[1]);
                }
            }
        }
    }
    async copyPromise(destination, source, { baseFs = this, overwrite = true } = {}) {
        const stat = await baseFs.lstatPromise(source);
        const exists = await this.existsSync(destination);
        if (stat.isDirectory()) {
            await this.mkdirpPromise(destination);
            const directoryListing = await baseFs.readdirPromise(source);
            await Promise.all(directoryListing.map(entry => {
                return this.copyPromise(this.pathUtils.join(destination, entry), baseFs.pathUtils.join(source, entry), { baseFs, overwrite });
            }));
        }
        else if (stat.isFile()) {
            if (!exists || overwrite) {
                if (exists)
                    await this.removePromise(destination);
                const content = await baseFs.readFilePromise(source);
                await this.writeFilePromise(destination, content);
            }
        }
        else if (stat.isSymbolicLink()) {
            if (!exists || overwrite) {
                if (exists)
                    await this.removePromise(destination);
                const target = await baseFs.readlinkPromise(source);
                await this.symlinkPromise(Object(_path__WEBPACK_IMPORTED_MODULE_0__[/* convertPath */ "b"])(this.pathUtils, target), destination);
            }
        }
        else {
            throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
        }
        const mode = stat.mode & 0o777;
        await this.chmodPromise(destination, mode);
    }
    copySync(destination, source, { baseFs = this, overwrite = true } = {}) {
        const stat = baseFs.lstatSync(source);
        const exists = this.existsSync(destination);
        if (stat.isDirectory()) {
            this.mkdirpSync(destination);
            const directoryListing = baseFs.readdirSync(source);
            for (const entry of directoryListing) {
                this.copySync(this.pathUtils.join(destination, entry), baseFs.pathUtils.join(source, entry), { baseFs, overwrite });
            }
        }
        else if (stat.isFile()) {
            if (!exists || overwrite) {
                if (exists)
                    this.removeSync(destination);
                const content = baseFs.readFileSync(source);
                this.writeFileSync(destination, content);
            }
        }
        else if (stat.isSymbolicLink()) {
            if (!exists || overwrite) {
                if (exists)
                    this.removeSync(destination);
                const target = baseFs.readlinkSync(source);
                this.symlinkSync(Object(_path__WEBPACK_IMPORTED_MODULE_0__[/* convertPath */ "b"])(this.pathUtils, target), destination);
            }
        }
        else {
            throw new Error(`Unsupported file type (file: ${source}, mode: 0o${stat.mode.toString(8).padStart(6, `0`)})`);
        }
        const mode = stat.mode & 0o777;
        this.chmodSync(destination, mode);
    }
    async changeFilePromise(p, content) {
        try {
            const current = await this.readFilePromise(p, `utf8`);
            if (current === content) {
                return;
            }
        }
        catch (error) {
            // ignore errors, no big deal
        }
        await this.writeFilePromise(p, content);
    }
    changeFileSync(p, content) {
        try {
            const current = this.readFileSync(p, `utf8`);
            if (current === content) {
                return;
            }
        }
        catch (error) {
            // ignore errors, no big deal
        }
        this.writeFileSync(p, content);
    }
    async movePromise(fromP, toP) {
        try {
            await this.renamePromise(fromP, toP);
        }
        catch (error) {
            if (error.code === `EXDEV`) {
                await this.copyPromise(toP, fromP);
                await this.removePromise(fromP);
            }
            else {
                throw error;
            }
        }
    }
    moveSync(fromP, toP) {
        try {
            this.renameSync(fromP, toP);
        }
        catch (error) {
            if (error.code === `EXDEV`) {
                this.copySync(toP, fromP);
                this.removeSync(fromP);
            }
            else {
                throw error;
            }
        }
    }
    async lockPromise(affectedPath, callback) {
        const lockPath = `${affectedPath}.lock`;
        const interval = 1000 / 60;
        const timeout = Date.now() + 60 * 1000;
        let fd = null;
        while (fd === null) {
            try {
                fd = await this.openPromise(lockPath, `wx`);
            }
            catch (error) {
                if (error.code === `EEXIST`) {
                    if (Date.now() < timeout) {
                        await new Promise(resolve => setTimeout(resolve, interval));
                    }
                    else {
                        throw new Error(`Couldn't acquire a lock in a reasonable time (via ${lockPath})`);
                    }
                }
                else {
                    throw error;
                }
            }
        }
        try {
            await callback();
        }
        finally {
            await this.closePromise(fd);
            await this.unlinkPromise(lockPath);
        }
    }
}
;
class BasePortableFakeFS extends FakeFS {
    constructor() {
        super(_path__WEBPACK_IMPORTED_MODULE_0__[/* ppath */ "e"]);
    }
    resolve(p) {
        return this.pathUtils.resolve(_path__WEBPACK_IMPORTED_MODULE_0__[/* PortablePath */ "a"].root, p);
    }
}


/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 4 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return NodeFS; });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _FakeFS__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(0);




class NodeFS extends _FakeFS__WEBPACK_IMPORTED_MODULE_1__[/* BasePortableFakeFS */ "a"] {
    constructor(realFs = fs__WEBPACK_IMPORTED_MODULE_0___default.a) {
        super();
        this.realFs = realFs;
    }
    getRealPath() {
        return _path__WEBPACK_IMPORTED_MODULE_2__[/* PortablePath */ "a"].root;
    }
    async openPromise(p, flags, mode) {
        return await new Promise((resolve, reject) => {
            this.realFs.open(NodeFS.fromPortablePath(p), flags, mode, this.makeCallback(resolve, reject));
        });
    }
    openSync(p, flags, mode) {
        return this.realFs.openSync(NodeFS.fromPortablePath(p), flags, mode);
    }
    async closePromise(fd) {
        await new Promise((resolve, reject) => {
            this.realFs.close(fd, this.makeCallback(resolve, reject));
        });
    }
    closeSync(fd) {
        this.realFs.closeSync(fd);
    }
    createReadStream(p, opts) {
        return this.realFs.createReadStream(NodeFS.fromPortablePath(p), opts);
    }
    createWriteStream(p, opts) {
        return this.realFs.createWriteStream(NodeFS.fromPortablePath(p), opts);
    }
    async realpathPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.realpath(NodeFS.fromPortablePath(p), {}, this.makeCallback(resolve, reject));
        }).then(path => {
            return NodeFS.toPortablePath(path);
        });
    }
    realpathSync(p) {
        return NodeFS.toPortablePath(this.realFs.realpathSync(NodeFS.fromPortablePath(p), {}));
    }
    async existsPromise(p) {
        return await new Promise(resolve => {
            this.realFs.exists(NodeFS.fromPortablePath(p), resolve);
        });
    }
    accessSync(p, mode) {
        return this.realFs.accessSync(NodeFS.fromPortablePath(p), mode);
    }
    async accessPromise(p, mode) {
        return await new Promise((resolve, reject) => {
            this.realFs.access(NodeFS.fromPortablePath(p), mode, this.makeCallback(resolve, reject));
        });
    }
    existsSync(p) {
        return this.realFs.existsSync(NodeFS.fromPortablePath(p));
    }
    async statPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.stat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    statSync(p) {
        return this.realFs.statSync(NodeFS.fromPortablePath(p));
    }
    async lstatPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.lstat(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    lstatSync(p) {
        return this.realFs.lstatSync(NodeFS.fromPortablePath(p));
    }
    async chmodPromise(p, mask) {
        return await new Promise((resolve, reject) => {
            this.realFs.chmod(NodeFS.fromPortablePath(p), mask, this.makeCallback(resolve, reject));
        });
    }
    chmodSync(p, mask) {
        return this.realFs.chmodSync(NodeFS.fromPortablePath(p), mask);
    }
    async renamePromise(oldP, newP) {
        return await new Promise((resolve, reject) => {
            this.realFs.rename(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP), this.makeCallback(resolve, reject));
        });
    }
    renameSync(oldP, newP) {
        return this.realFs.renameSync(NodeFS.fromPortablePath(oldP), NodeFS.fromPortablePath(newP));
    }
    async copyFilePromise(sourceP, destP, flags = 0) {
        return await new Promise((resolve, reject) => {
            this.realFs.copyFile(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags, this.makeCallback(resolve, reject));
        });
    }
    copyFileSync(sourceP, destP, flags = 0) {
        return this.realFs.copyFileSync(NodeFS.fromPortablePath(sourceP), NodeFS.fromPortablePath(destP), flags);
    }
    async writeFilePromise(p, content, opts) {
        return await new Promise((resolve, reject) => {
            if (opts) {
                this.realFs.writeFile(NodeFS.fromPortablePath(p), content, opts, this.makeCallback(resolve, reject));
            }
            else {
                this.realFs.writeFile(NodeFS.fromPortablePath(p), content, this.makeCallback(resolve, reject));
            }
        });
    }
    writeFileSync(p, content, opts) {
        if (opts) {
            this.realFs.writeFileSync(NodeFS.fromPortablePath(p), content, opts);
        }
        else {
            this.realFs.writeFileSync(NodeFS.fromPortablePath(p), content);
        }
    }
    async unlinkPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.unlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    unlinkSync(p) {
        return this.realFs.unlinkSync(NodeFS.fromPortablePath(p));
    }
    async utimesPromise(p, atime, mtime) {
        return await new Promise((resolve, reject) => {
            this.realFs.utimes(NodeFS.fromPortablePath(p), atime, mtime, this.makeCallback(resolve, reject));
        });
    }
    utimesSync(p, atime, mtime) {
        this.realFs.utimesSync(NodeFS.fromPortablePath(p), atime, mtime);
    }
    async mkdirPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.mkdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    mkdirSync(p) {
        return this.realFs.mkdirSync(NodeFS.fromPortablePath(p));
    }
    async rmdirPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.rmdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    rmdirSync(p) {
        return this.realFs.rmdirSync(NodeFS.fromPortablePath(p));
    }
    async symlinkPromise(target, p) {
        const type = target.endsWith(`/`) ? `dir` : `file`;
        return await new Promise((resolve, reject) => {
            this.realFs.symlink(NodeFS.fromPortablePath(target.replace(/\/+$/, ``)), NodeFS.fromPortablePath(p), type, this.makeCallback(resolve, reject));
        });
    }
    symlinkSync(target, p) {
        const type = target.endsWith(`/`) ? `dir` : `file`;
        return this.realFs.symlinkSync(NodeFS.fromPortablePath(target.replace(/\/+$/, ``)), NodeFS.fromPortablePath(p), type);
    }
    async readFilePromise(p, encoding) {
        return await new Promise((resolve, reject) => {
            this.realFs.readFile(NodeFS.fromPortablePath(p), encoding, this.makeCallback(resolve, reject));
        });
    }
    readFileSync(p, encoding) {
        return this.realFs.readFileSync(NodeFS.fromPortablePath(p), encoding);
    }
    async readdirPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.readdir(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        });
    }
    readdirSync(p) {
        return this.realFs.readdirSync(NodeFS.fromPortablePath(p));
    }
    async readlinkPromise(p) {
        return await new Promise((resolve, reject) => {
            this.realFs.readlink(NodeFS.fromPortablePath(p), this.makeCallback(resolve, reject));
        }).then(path => {
            return NodeFS.toPortablePath(path);
        });
    }
    readlinkSync(p) {
        return NodeFS.toPortablePath(this.realFs.readlinkSync(NodeFS.fromPortablePath(p)));
    }
    makeCallback(resolve, reject) {
        return (err, result) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        };
    }
    static fromPortablePath(p) {
        return Object(_path__WEBPACK_IMPORTED_MODULE_2__[/* fromPortablePath */ "c"])(p);
    }
    static toPortablePath(p) {
        return Object(_path__WEBPACK_IMPORTED_MODULE_2__[/* toPortablePath */ "g"])(p);
    }
}


/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 6 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return dynamicRequire; });
const dynamicRequire =  true
    ? require
    : undefined;



/***/ }),
/* 7 */,
/* 8 */,
/* 9 */,
/* 10 */,
/* 11 */,
/* 12 */,
/* 13 */,
/* 14 */,
/* 15 */
/***/ (function(module, exports) {

module.exports = require("child_process");

/***/ }),
/* 16 */
/***/ (function(module) {

module.exports = {"name":"typescript","author":"Microsoft Corp.","homepage":"https://www.typescriptlang.org/","version":"3.3.3333","license":"Apache-2.0","description":"TypeScript is a language for application scale JavaScript development","keywords":["TypeScript","Microsoft","compiler","language","javascript"],"bugs":{"url":"https://github.com/Microsoft/TypeScript/issues"},"repository":{"type":"git","url":"https://github.com/Microsoft/TypeScript.git"},"main":"./lib/typescript.js","typings":"./lib/typescript.d.ts","bin":{"tsc":"./bin/tsc","tsserver":"./bin/tsserver"},"engines":{"node":">=4.2.0"},"devDependencies":{"@octokit/rest":"latest","@types/browserify":"latest","@types/chai":"latest","@types/convert-source-map":"latest","@types/del":"latest","@types/glob":"latest","@types/gulp":"3.X","@types/gulp-concat":"latest","@types/gulp-help":"latest","@types/gulp-if":"0.0.33","@types/gulp-newer":"latest","@types/gulp-rename":"0.0.33","@types/gulp-sourcemaps":"0.0.32","@types/jake":"latest","@types/merge2":"latest","@types/minimatch":"latest","@types/minimist":"latest","@types/mkdirp":"latest","@types/mocha":"latest","@types/node":"8.5.5","@types/q":"latest","@types/run-sequence":"latest","@types/source-map-support":"latest","@types/through2":"latest","@types/travis-fold":"latest","@types/xml2js":"^0.4.0","browser-resolve":"^1.11.2","browserify":"latest","chai":"latest","chalk":"latest","convert-source-map":"latest","del":"latest","fancy-log":"latest","fs-extra":"^6.0.1","gulp":"3.X","gulp-clone":"latest","gulp-concat":"latest","gulp-help":"latest","gulp-if":"latest","gulp-insert":"latest","gulp-newer":"latest","gulp-rename":"latest","gulp-sourcemaps":"latest","gulp-typescript":"latest","istanbul":"latest","jake":"latest","lodash":"4.17.10","merge2":"latest","minimist":"latest","mkdirp":"latest","mocha":"latest","mocha-fivemat-progress-reporter":"latest","plugin-error":"latest","pretty-hrtime":"^1.0.3","prex":"^0.4.3","q":"latest","remove-internal":"^2.9.2","run-sequence":"latest","source-map-support":"latest","through2":"latest","travis-fold":"latest","tslint":"latest","typescript":"next","vinyl":"latest","vinyl-sourcemaps-apply":"latest","xml2js":"^0.4.19"},"scripts":{"pretest":"jake tests","test":"jake runtests-parallel light=false","build":"npm run build:compiler && npm run build:tests","build:compiler":"jake local","build:tests":"jake tests","start":"node lib/tsc","clean":"jake clean","gulp":"gulp","jake":"jake","lint":"jake lint","setup-hooks":"node scripts/link-hooks.js"},"browser":{"fs":false,"os":false,"path":false},"dependencies":{}};

/***/ }),
/* 17 */,
/* 18 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);

// EXTERNAL MODULE: ../berry-fslib/sources/path.ts
var path = __webpack_require__(0);

// EXTERNAL MODULE: ../berry-fslib/sources/NodeFS.ts
var NodeFS = __webpack_require__(4);

// EXTERNAL MODULE: external "child_process"
var external_child_process_ = __webpack_require__(15);

// EXTERNAL MODULE: ./sources/dynamicRequire.ts
var dynamicRequire = __webpack_require__(6);

// EXTERNAL MODULE: ../berry-fslib/sources/index.ts
var sources = __webpack_require__(1);

// CONCATENATED MODULE: ./sources/generateSdk.ts

const TEMPLATE = (relPnpApiPath) => [
    `const relPnpApiPath = ${JSON.stringify(NodeFS["a" /* NodeFS */].toPortablePath(relPnpApiPath))};\n`,
    `const absPnpApiPath = require(\`path\`).resolve(__dirname, relPnpApiPath);\n`,
    `\n`,
    `// Setup the environment to be able to require @berry/pnpify\n`,
    `require(absPnpApiPath).setup();\n`,
    `\n`,
    `// Prepare the environment (to be ready in case of child_process.spawn etc)\n`,
    `process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || \`\`;\n`,
    `process.env.NODE_OPTIONS += \` -r \${absPnpApiPath}\`;\n`,
    `process.env.NODE_OPTIONS += \` -r \${require.resolve(\`@berry/pnpify/lib\`)}\`;\n`,
    `\n`,
    `// Apply PnPify to the current process\n`,
    `require(\`@berry/pnpify/lib\`).patchFs();\n`,
    `\n`,
    `// Defer to the real typescript your application uses\n`,
    `require(\`typescript/lib/tsserver\`);\n`,
].join(``);
async function generateSdk(projectRoot, targetFolder) {
    if (targetFolder === null)
        targetFolder = projectRoot;
    const tssdk = path["e" /* ppath */].join(targetFolder, `tssdk`);
    const tssdkManifest = path["e" /* ppath */].join(tssdk, `package.json`);
    const tsserver = path["e" /* ppath */].join(tssdk, `lib/tsserver.js`);
    const relPnpApiPath = path["e" /* ppath */].relative(path["e" /* ppath */].dirname(tsserver), path["e" /* ppath */].join(projectRoot, `.pnp.js`));
    await sources["b" /* xfs */].removePromise(tssdk);
    await sources["b" /* xfs */].mkdirpPromise(path["e" /* ppath */].dirname(tsserver));
    await sources["b" /* xfs */].writeFilePromise(tssdkManifest, JSON.stringify({ name: 'typescript', version: `${__webpack_require__(16).version}-pnpify` }, null, 2));
    await sources["b" /* xfs */].writeFilePromise(tsserver, TEMPLATE(relPnpApiPath));
    const settings = path["e" /* ppath */].join(projectRoot, `.vscode/settings.json`);
    const content = await sources["b" /* xfs */].existsPromise(settings) ? await sources["b" /* xfs */].readFilePromise(settings, `utf8`) : ``;
    const data = JSON.parse(content);
    data[`typescript.tsdk`] = NodeFS["a" /* NodeFS */].fromPortablePath(path["e" /* ppath */].relative(projectRoot, path["e" /* ppath */].dirname(tsserver)));
    const patched = `${JSON.stringify(data, null, 2)}\n`;
    await sources["b" /* xfs */].mkdirpPromise(path["e" /* ppath */].dirname(settings));
    await sources["b" /* xfs */].changeFilePromise(settings, patched);
}

// CONCATENATED MODULE: ./sources/bin.ts




const [, , bin_name, ...rest] = process.argv;
if (bin_name === `--help` || bin_name === `-h`)
    help(false);
else if (bin_name === `--sdk` && rest.length === 0)
    sdk(null);
else if (bin_name === `--sdk` && rest.length === 1)
    sdk(path["e" /* ppath */].resolve(NodeFS["a" /* NodeFS */].toPortablePath(rest[0])));
else if (typeof bin_name !== `undefined` && bin_name[0] !== `-`)
    run(bin_name, rest);
else
    help(true);
function help(error) {
    const logFn = error ? console.error : console.log;
    process.exitCode = error ? 1 : 0;
    logFn(`Usage: yarn pnpify --sdk`);
    logFn(`Usage: yarn pnpify <program> [...argv]`);
    logFn();
    logFn(`Setups a TypeScript sdk for use within your VSCode editor instance`);
    logFn(`More info at https://yarnpkg.github.io/berry/advanced/pnpify`);
}
function sdk(targetFolder) {
    const { getPackageInformation, topLevel } = Object(dynamicRequire["a" /* dynamicRequire */])(`pnpapi`);
    const { packageLocation } = getPackageInformation(topLevel);
    const projectRoot = NodeFS["a" /* NodeFS */].toPortablePath(packageLocation);
    generateSdk(projectRoot, targetFolder).catch(error => {
        console.error(error.stack);
        process.exitCode = 1;
    });
}
function run(name, argv) {
    let { NODE_OPTIONS } = process.env;
    NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${dynamicRequire["a" /* dynamicRequire */].resolve(`@berry/pnpify`)}`.trim();
    const child = Object(external_child_process_["spawn"])(name, argv, {
        env: Object.assign({}, process.env, { NODE_OPTIONS }),
        stdio: `inherit`,
    });
    child.on(`exit`, code => {
        process.exitCode = code !== null ? code : 1;
    });
}


/***/ })
/******/ ]);