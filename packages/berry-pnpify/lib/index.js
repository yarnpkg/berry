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
/******/ 	return __webpack_require__(__webpack_require__.s = 19);
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
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(7);
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
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 2 */
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
/* 3 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return dynamicRequire; });
const dynamicRequire =  true
    ? require
    : undefined;



/***/ }),
/* 4 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return NodeFS; });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _FakeFS__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
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
/* 6 */
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


/***/ }),
/* 7 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 8 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";

// EXTERNAL MODULE: ../berry-fslib/sources/NodeFS.ts
var NodeFS = __webpack_require__(4);

// EXTERNAL MODULE: ../berry-fslib/sources/FakeFS.ts
var FakeFS = __webpack_require__(5);

// CONCATENATED MODULE: ../berry-fslib/sources/ProxiedFS.ts

class ProxiedFS_ProxiedFS extends FakeFS["b" /* FakeFS */] {
    resolve(path) {
        return this.mapFromBase(this.baseFs.resolve(this.mapToBase(path)));
    }
    getRealPath() {
        return this.mapFromBase(this.baseFs.getRealPath());
    }
    openPromise(p, flags, mode) {
        return this.baseFs.openPromise(this.mapToBase(p), flags, mode);
    }
    openSync(p, flags, mode) {
        return this.baseFs.openSync(this.mapToBase(p), flags, mode);
    }
    closePromise(fd) {
        return this.baseFs.closePromise(fd);
    }
    closeSync(fd) {
        this.baseFs.closeSync(fd);
    }
    createReadStream(p, opts) {
        return this.baseFs.createReadStream(this.mapToBase(p), opts);
    }
    createWriteStream(p, opts) {
        return this.baseFs.createWriteStream(this.mapToBase(p), opts);
    }
    async realpathPromise(p) {
        return this.mapFromBase(await this.baseFs.realpathPromise(this.mapToBase(p)));
    }
    realpathSync(p) {
        return this.mapFromBase(this.baseFs.realpathSync(this.mapToBase(p)));
    }
    existsPromise(p) {
        return this.baseFs.existsPromise(this.mapToBase(p));
    }
    existsSync(p) {
        return this.baseFs.existsSync(this.mapToBase(p));
    }
    accessSync(p, mode) {
        return this.baseFs.accessSync(this.mapToBase(p), mode);
    }
    accessPromise(p, mode) {
        return this.baseFs.accessPromise(this.mapToBase(p), mode);
    }
    statPromise(p) {
        return this.baseFs.statPromise(this.mapToBase(p));
    }
    statSync(p) {
        return this.baseFs.statSync(this.mapToBase(p));
    }
    lstatPromise(p) {
        return this.baseFs.lstatPromise(this.mapToBase(p));
    }
    lstatSync(p) {
        return this.baseFs.lstatSync(this.mapToBase(p));
    }
    chmodPromise(p, mask) {
        return this.baseFs.chmodPromise(this.mapToBase(p), mask);
    }
    chmodSync(p, mask) {
        return this.baseFs.chmodSync(this.mapToBase(p), mask);
    }
    renamePromise(oldP, newP) {
        return this.baseFs.renamePromise(this.mapToBase(oldP), this.mapToBase(newP));
    }
    renameSync(oldP, newP) {
        return this.baseFs.renameSync(this.mapToBase(oldP), this.mapToBase(newP));
    }
    copyFilePromise(sourceP, destP, flags = 0) {
        return this.baseFs.copyFilePromise(this.mapToBase(sourceP), this.mapToBase(destP), flags);
    }
    copyFileSync(sourceP, destP, flags = 0) {
        return this.baseFs.copyFileSync(this.mapToBase(sourceP), this.mapToBase(destP), flags);
    }
    writeFilePromise(p, content, opts) {
        return this.baseFs.writeFilePromise(this.mapToBase(p), content, opts);
    }
    writeFileSync(p, content, opts) {
        return this.baseFs.writeFileSync(this.mapToBase(p), content, opts);
    }
    unlinkPromise(p) {
        return this.baseFs.unlinkPromise(this.mapToBase(p));
    }
    unlinkSync(p) {
        return this.baseFs.unlinkSync(this.mapToBase(p));
    }
    utimesPromise(p, atime, mtime) {
        return this.baseFs.utimesPromise(this.mapToBase(p), atime, mtime);
    }
    utimesSync(p, atime, mtime) {
        return this.baseFs.utimesSync(this.mapToBase(p), atime, mtime);
    }
    mkdirPromise(p) {
        return this.baseFs.mkdirPromise(this.mapToBase(p));
    }
    mkdirSync(p) {
        return this.baseFs.mkdirSync(this.mapToBase(p));
    }
    rmdirPromise(p) {
        return this.baseFs.rmdirPromise(this.mapToBase(p));
    }
    rmdirSync(p) {
        return this.baseFs.rmdirSync(this.mapToBase(p));
    }
    symlinkPromise(target, p) {
        return this.baseFs.symlinkPromise(this.mapToBase(target), this.mapToBase(p));
    }
    symlinkSync(target, p) {
        return this.baseFs.symlinkSync(this.mapToBase(target), this.mapToBase(p));
    }
    readFilePromise(p, encoding) {
        // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
        if (encoding === 'utf8') {
            return this.baseFs.readFilePromise(this.mapToBase(p), encoding);
        }
        else {
            return this.baseFs.readFilePromise(this.mapToBase(p), encoding);
        }
    }
    readFileSync(p, encoding) {
        // This weird condition is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
        if (encoding === 'utf8') {
            return this.baseFs.readFileSync(this.mapToBase(p), encoding);
        }
        else {
            return this.baseFs.readFileSync(this.mapToBase(p), encoding);
        }
    }
    readdirPromise(p) {
        return this.baseFs.readdirPromise(this.mapToBase(p));
    }
    readdirSync(p) {
        return this.baseFs.readdirSync(this.mapToBase(p));
    }
    async readlinkPromise(p) {
        return this.mapFromBase(await this.baseFs.readlinkPromise(this.mapToBase(p)));
    }
    readlinkSync(p) {
        return this.mapFromBase(this.baseFs.readlinkSync(this.mapToBase(p)));
    }
}

// EXTERNAL MODULE: ../berry-fslib/sources/path.ts
var sources_path = __webpack_require__(0);

// CONCATENATED MODULE: ../berry-fslib/sources/PosixFS.ts
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return PosixFS_PosixFS; });



class PosixFS_PosixFS extends ProxiedFS_ProxiedFS {
    constructor(baseFs) {
        super(sources_path["d" /* npath */]);
        this.baseFs = baseFs;
    }
    mapFromBase(path) {
        return NodeFS["a" /* NodeFS */].fromPortablePath(path);
    }
    mapToBase(path) {
        return NodeFS["a" /* NodeFS */].toPortablePath(path);
    }
}


/***/ }),
/* 9 */,
/* 10 */,
/* 11 */,
/* 12 */,
/* 13 */,
/* 14 */,
/* 15 */,
/* 16 */
/***/ (function(module, exports) {

module.exports = require("events");

/***/ }),
/* 17 */,
/* 18 */,
/* 19 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);

// EXTERNAL MODULE: ../berry-fslib/sources/PosixFS.ts + 1 modules
var PosixFS = __webpack_require__(8);

// EXTERNAL MODULE: ../berry-fslib/sources/NodeFS.ts
var NodeFS = __webpack_require__(4);

// EXTERNAL MODULE: ../berry-fslib/sources/index.ts
var sources = __webpack_require__(2);

// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(1);
var external_fs_default = /*#__PURE__*/__webpack_require__.n(external_fs_);

// EXTERNAL MODULE: ../berry-fslib/sources/FakeFS.ts
var FakeFS = __webpack_require__(5);

// EXTERNAL MODULE: ../berry-fslib/sources/path.ts
var path = __webpack_require__(0);

// CONCATENATED MODULE: ./sources/NodePathResolver.ts

/**
 * Regexp for pathname that catches the following paths:
 *
 * 1. A path without `/node_modules` in the beginning. We don't process these, since they cannot be inside any of PnP package roots
 * 2. A path with incomplete or complete package name inside, e.g. `/node_modules[/@scope][/foo]`
 *
 * And everything at the end of the pathname
 */
const NODE_MODULES_REGEXP = /(?:[\\\/]node_modules((?:[\\\/]@[^\\\/]+)?(?:[\\\/][^@][^\\\/]+)?))?(.*)/;
/**
 * Resolves `node_modules` paths inside PnP projects.
 *
 * The idea: for path like `node_modules/foo/node_modules/bar` we use `foo` as an issuer
 * and resolve `bar` for this issuer using `pnpapi`.
 */
class NodePathResolver_NodePathResolver {
    /**
     * Constructs new instance of Node path resolver
     *
     * @param options optional Node path resolver options
     */
    constructor(options) {
        this.options = options;
    }
    /**
     * Returns `readdir`-like result for partially resolved pnp path
     *
     * @param issuerInfo issuer package information
     * @param scope null - for `/node_modules` dir list or '@scope' - for `/node_modules/@scope` dir list
     *
     * @returns `undefined` - if dir does not exist, or `readdir`-like list of subdirs in the virtual dir
     */
    readDir(issuerInfo, scope) {
        const result = new Set();
        for (const key of issuerInfo.packageDependencies.keys()) {
            const [pkgNameOrScope, pkgName] = key.split('/');
            if (!scope) {
                if (!result.has(Object(path["f" /* toFilename */])(pkgNameOrScope))) {
                    result.add(Object(path["f" /* toFilename */])(pkgNameOrScope));
                }
            }
            else if (scope === pkgNameOrScope) {
                result.add(Object(path["f" /* toFilename */])(pkgName));
            }
        }
        return result.size === 0 ? undefined : Array.from(result);
    }
    getIssuer(pnp, pathname, pathSep) {
        const locator = pnp.findPackageLocator(pathname + pathSep);
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
     * @param nodePath full path containing `node_modules`
     *
     * @returns resolved path
     */
    resolvePath(nodePath) {
        const result = { resolvedPath: nodePath };
        const isWindowsPath = nodePath.indexOf('\\') > 0;
        const pathSep = isWindowsPath ? '\\' : '/';
        if (nodePath.indexOf(`${pathSep}node_modules`) < 0)
            // Non-node_modules paths should not be processed
            return result;
        const pnpApiPath = this.options.apiLocator.findApi(nodePath);
        const pnp = pnpApiPath && this.options.apiLoader.getApi(pnpApiPath);
        if (pnpApiPath && pnp) {
            // Extract first issuer from the path using PnP API
            let issuer = this.getIssuer(pnp, nodePath, pathSep);
            let request;
            // If we have something left in a path to parse, do that
            if (issuer && nodePath.length > issuer.length) {
                request = nodePath.substring(issuer.length);
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
                        if (pkgName !== undefined) {
                            if (pkgName.length > 0 && (pkgName[0] !== '@' || pkgName.indexOf(pathSep) > 0)) {
                                try {
                                    let res = pnp.resolveToUnqualified(pkgName, issuer + pathSep);
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
                        const locator = pnp.findPackageLocator(issuer + pathSep);
                        const issuerInfo = locator ? pnp.getPackageInformation(locator) : undefined;
                        if (issuerInfo) {
                            const scope = request || null;
                            result.dirList = this.readDir(issuerInfo, scope);
                        }
                        if (result.dirList) {
                            result.statPath = isWindowsPath ? issuer.replace(/\//g, '\\') : issuer;
                        }
                        else {
                            result.resolvedPath = null;
                        }
                    }
                    else {
                        result.resolvedPath = isWindowsPath ? (issuer + request).replace(/\//g, '\\') : (issuer + request);
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

// EXTERNAL MODULE: external "events"
var external_events_ = __webpack_require__(16);
var external_events_default = /*#__PURE__*/__webpack_require__.n(external_events_);

// EXTERNAL MODULE: ./sources/dynamicRequire.ts
var dynamicRequire = __webpack_require__(3);

// CONCATENATED MODULE: ./sources/PnPApiLoader.ts


/**
 * Loads PnP API from the PnP API path in a cached way, then
 * watches for changes to this file and if any - invalidates cache
 * and emits an event
 */
class PnPApiLoader_PnPApiLoader extends external_events_default.a {
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
                delete __webpack_require__.c[dynamicRequire["a" /* dynamicRequire */].resolve(modulePath)];
                return Object(dynamicRequire["a" /* dynamicRequire */])(modulePath);
            }),
            watch: opts.watch,
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

// EXTERNAL MODULE: ./sources/PnPApiLocator.ts
var PnPApiLocator = __webpack_require__(6);

// CONCATENATED MODULE: ./sources/NodeModulesFS.ts






class NodeModulesFS_NodeModulesFS extends FakeFS["b" /* FakeFS */] {
    constructor({ baseFs = new PosixFS["a" /* PosixFS */](new NodeFS["a" /* NodeFS */]()) } = {}) {
        super(path["d" /* npath */]);
        this.baseFs = baseFs;
        this.pathResolver = new NodePathResolver_NodePathResolver({
            apiLoader: new PnPApiLoader_PnPApiLoader({ watch: external_fs_default.a.watch.bind(external_fs_default.a) }),
            apiLocator: new PnPApiLocator["a" /* PnPApiLocator */]({ existsSync: baseFs.existsSync.bind(baseFs) }),
        });
    }
    resolve(path) {
        return this.baseFs.resolve(this.resolvePath(path).resolvedPath);
    }
    getBaseFs() {
        return this.baseFs;
    }
    resolvePath(p) {
        const fullOriginalPath = path["d" /* npath */].resolve(p);
        return Object.assign({}, this.pathResolver.resolvePath(fullOriginalPath), { fullOriginalPath });
    }
    resolveFilePath(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
        }
        else {
            return pnpPath.resolvedPath;
        }
    }
    resolveLink(p, op, onSymlink, onRealPath) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('ENOENT', `no such file or directory, ${op} '${p}'`);
        }
        else {
            if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
                try {
                    const stats = this.baseFs.lstatSync(pnpPath.statPath || pnpPath.resolvedPath);
                    if (stats.isDirectory()) {
                        throw NodeModulesFS_NodeModulesFS.createFsError('EINVAL', `invalid argument, ${op} '${p}'`);
                    }
                    else {
                        return onSymlink(stats, path["d" /* npath */].relative(path["d" /* npath */].dirname(pnpPath.fullOriginalPath), pnpPath.statPath || pnpPath.resolvedPath));
                    }
                }
                catch (e) {
                }
            }
        }
        return onRealPath();
    }
    static makeSymlinkStats(stats) {
        return Object.assign(stats, {
            isFile: () => false,
            isDirectory: () => false,
            isSymbolicLink: () => true,
        });
    }
    static createFsError(code, message) {
        return Object.assign(new Error(`${code}: ${message}`), { code });
    }
    throwIfPathReadonly(op, p) {
        const pnpPath = this.resolvePath(p);
        if (pnpPath.resolvedPath !== pnpPath.fullOriginalPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('EPERM', `operation not permitted, ${op} '${p}'`);
        }
        else {
            return p;
        }
    }
    resolveDirOrFilePath(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('ENOENT', `no such file or directory, stat '${p}'`);
        }
        else {
            return pnpPath.statPath || pnpPath.resolvedPath;
        }
    }
    getRealPath() {
        return this.baseFs.getRealPath();
    }
    async openPromise(p, flags, mode) {
        return await this.baseFs.openPromise(this.resolveFilePath(p), flags, mode);
    }
    openSync(p, flags, mode) {
        return this.baseFs.openSync(this.resolveFilePath(p), flags, mode);
    }
    async closePromise(fd) {
        await this.baseFs.closePromise(fd);
    }
    closeSync(fd) {
        this.baseFs.closeSync(fd);
    }
    createReadStream(p, opts) {
        return this.baseFs.createReadStream(this.resolveFilePath(p), opts);
    }
    createWriteStream(p, opts) {
        return this.baseFs.createWriteStream(this.throwIfPathReadonly('createWriteStream', p), opts);
    }
    async realpathPromise(p) {
        return await this.baseFs.realpathPromise(this.resolveFilePath(p));
    }
    realpathSync(p) {
        return this.baseFs.realpathSync(this.resolveFilePath(p));
    }
    async existsPromise(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            return false;
        }
        else if (pnpPath.statPath) {
            return true;
        }
        else {
            return await this.baseFs.existsPromise(pnpPath.resolvedPath);
        }
    }
    existsSync(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            return false;
        }
        else if (pnpPath.statPath) {
            return true;
        }
        else {
            return this.baseFs.existsSync(pnpPath.resolvedPath);
        }
    }
    async accessPromise(p, mode) {
        return await this.baseFs.accessPromise(this.resolveDirOrFilePath(p), mode);
    }
    accessSync(p, mode) {
        return this.baseFs.accessSync(this.resolveDirOrFilePath(p), mode);
    }
    async statPromise(p) {
        return await this.baseFs.statPromise(this.resolveDirOrFilePath(p));
    }
    statSync(p) {
        return this.baseFs.statSync(this.resolveDirOrFilePath(p));
    }
    async lstatPromise(p) {
        return this.resolveLink(p, 'lstat', (stats) => NodeModulesFS_NodeModulesFS.makeSymlinkStats(stats), async () => await this.baseFs.lstatPromise(p));
    }
    lstatSync(p) {
        return this.resolveLink(p, 'lstat', (stats) => NodeModulesFS_NodeModulesFS.makeSymlinkStats(stats), () => this.baseFs.lstatSync(p));
    }
    async chmodPromise(p, mask) {
        return await this.baseFs.chmodPromise(this.throwIfPathReadonly('chmod', p), mask);
    }
    chmodSync(p, mask) {
        return this.baseFs.chmodSync(this.throwIfPathReadonly('chmodSync', p), mask);
    }
    async renamePromise(oldP, newP) {
        return await this.baseFs.renamePromise(this.throwIfPathReadonly('rename', oldP), this.throwIfPathReadonly('rename', newP));
    }
    renameSync(oldP, newP) {
        return this.baseFs.renameSync(this.throwIfPathReadonly('renameSync', oldP), this.throwIfPathReadonly('renameSync', newP));
    }
    async copyFilePromise(sourceP, destP, flags) {
        return await this.baseFs.copyFilePromise(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFile', destP), flags);
    }
    copyFileSync(sourceP, destP, flags) {
        return this.baseFs.copyFileSync(this.resolveFilePath(sourceP), this.throwIfPathReadonly('copyFileSync', destP), flags);
    }
    async writeFilePromise(p, content, opts) {
        return await this.baseFs.writeFilePromise(this.throwIfPathReadonly('writeFile', p), content, opts);
    }
    writeFileSync(p, content, opts) {
        return this.baseFs.writeFileSync(this.throwIfPathReadonly('writeFileSync', p), content, opts);
    }
    async unlinkPromise(p) {
        return await this.baseFs.unlinkPromise(this.throwIfPathReadonly('unlink', p));
    }
    unlinkSync(p) {
        return this.baseFs.unlinkSync(this.throwIfPathReadonly('unlinkSync', p));
    }
    async utimesPromise(p, atime, mtime) {
        return await this.baseFs.utimesPromise(this.resolveDirOrFilePath(p), atime, mtime);
    }
    utimesSync(p, atime, mtime) {
        return this.baseFs.utimesSync(this.resolveDirOrFilePath(p), atime, mtime);
    }
    async mkdirPromise(p) {
        return await this.baseFs.mkdirPromise(this.throwIfPathReadonly('mkdir', p));
    }
    mkdirSync(p) {
        return this.baseFs.mkdirSync(this.throwIfPathReadonly('mkdirSync', p));
    }
    async rmdirPromise(p) {
        return await this.baseFs.rmdirPromise(this.throwIfPathReadonly('rmdir', p));
    }
    rmdirSync(p) {
        return this.baseFs.rmdirSync(this.throwIfPathReadonly('rmdirSync', p));
    }
    async symlinkPromise(target, p) {
        return await this.baseFs.symlinkPromise(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlink', p));
    }
    symlinkSync(target, p) {
        return this.baseFs.symlinkSync(this.resolveDirOrFilePath(target), this.throwIfPathReadonly('symlinkSync', p));
    }
    async readFilePromise(p, encoding) {
        // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
        switch (encoding) {
            case `utf8`:
                return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
            default:
                return await this.baseFs.readFilePromise(this.resolveFilePath(p), encoding);
        }
    }
    readFileSync(p, encoding) {
        // This weird switch is required to tell TypeScript that the signatures are proper (otherwise it thinks that only the generic one is covered)
        switch (encoding) {
            case `utf8`:
                return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
            default:
                return this.baseFs.readFileSync(this.resolveFilePath(p), encoding);
        }
    }
    async readdirPromise(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
        }
        else if (pnpPath.dirList) {
            return pnpPath.dirList;
        }
        else {
            return await this.baseFs.readdirPromise(pnpPath.resolvedPath);
        }
    }
    readdirSync(p) {
        const pnpPath = this.resolvePath(p);
        if (!pnpPath.resolvedPath) {
            throw NodeModulesFS_NodeModulesFS.createFsError('ENOENT', `no such file or directory, scandir '${p}'`);
        }
        else if (pnpPath.dirList) {
            return pnpPath.dirList;
        }
        else {
            return this.baseFs.readdirSync(pnpPath.resolvedPath);
        }
    }
    async readlinkPromise(p) {
        return this.resolveLink(p, 'readlink', (_stats, targetPath) => targetPath, async () => await this.baseFs.readlinkPromise(p));
    }
    readlinkSync(p) {
        return this.resolveLink(p, 'readlink', (_stats, targetPath) => targetPath, () => this.baseFs.readlinkSync(p));
    }
}

// CONCATENATED MODULE: ./sources/index.ts
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "patchFs", function() { return patchFs; });
/* concated harmony reexport PnPApiLocator */__webpack_require__.d(__webpack_exports__, "PnPApiLocator", function() { return PnPApiLocator["a" /* PnPApiLocator */]; });
/* concated harmony reexport NodeModulesFS */__webpack_require__.d(__webpack_exports__, "NodeModulesFS", function() { return NodeModulesFS_NodeModulesFS; });



let fsPatched = false;
const patchFs = () => {
    if (!fsPatched) {
        const localFs = Object.assign({}, external_fs_default.a);
        const baseFs = new PosixFS["a" /* PosixFS */](new NodeFS["a" /* NodeFS */](localFs));
        const nodeModulesFS = new NodeModulesFS_NodeModulesFS({ baseFs });
        Object(sources["a" /* patchFs */])(external_fs_default.a, nodeModulesFS);
        fsPatched = true;
    }
};
if (!process.mainModule)
    patchFs();




/***/ })
/******/ ]);