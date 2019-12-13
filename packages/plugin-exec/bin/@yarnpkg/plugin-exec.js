module.exports = {};

module.exports.factory = function (require) {
  var plugin =
  /******/ (function(modules) { // webpackBootstrap
  /******/ 	// The module cache
  /******/ 	var installedModules = {};
  /******/
  /******/ 	// object to store loaded chunks
  /******/ 	// "0" means "already loaded"
  /******/ 	var installedChunks = {
  /******/ 		0: 0
  /******/ 	};
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
  /******/ 	// uncaught error handler for webpack runtime
  /******/ 	__webpack_require__.oe = function(err) {
  /******/ 		process.nextTick(function() {
  /******/ 			throw err; // catch this error by using import().catch()
  /******/ 		});
  /******/ 	};
  /******/
  /******/
  /******/ 	// Load entry module and return exports
  /******/ 	return __webpack_require__(__webpack_require__.s = 0);
  /******/ })
  /************************************************************************/
  /******/ ([
  /* 0 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony import */ var _ExecFetcher__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
  /* harmony import */ var _ExecResolver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6);


  const plugin = {
    fetchers: [_ExecFetcher__WEBPACK_IMPORTED_MODULE_0__["ExecFetcher"]],
    resolvers: [_ExecResolver__WEBPACK_IMPORTED_MODULE_1__["ExecResolver"]]
  }; // eslint-disable-next-line arca/no-default-export

  /* harmony default export */ __webpack_exports__["default"] = (plugin);

  /***/ }),
  /* 1 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ExecFetcher", function() { return ExecFetcher; });
  /* harmony import */ var _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
  /* harmony import */ var _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__);
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__);
  /* harmony import */ var querystring__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
  /* harmony import */ var querystring__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(querystring__WEBPACK_IMPORTED_MODULE_2__);
  /* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(5);




  class ExecFetcher {
    supports(locator, opts) {
      if (!locator.reference.startsWith(_constants__WEBPACK_IMPORTED_MODULE_3__["PROTOCOL"])) return false;
      return true;
    }

    getLocalPath(locator, opts) {
      const {
        parentLocator,
        execPath
      } = this.parseLocator(locator);
      if (_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].isAbsolute(execPath)) return execPath;
      const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);

      if (parentLocalPath !== null) {
        return _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].resolve(parentLocalPath, execPath);
      } else {
        return null;
      }
    }

    async fetch(locator, opts) {
      const _ref = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 2, 7));

      const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;
      const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, async () => {
        opts.report.reportInfoOnce(_ref.MessageName.FETCH_NOT_CACHED, `${_yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.fetchFromDisk(locator, opts);
      });
      return {
        packageFs,
        releaseFs,
        prefixPath: _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].getIdentVendorPath(locator),
        localPath: this.getLocalPath(locator, opts),
        checksum
      };
    }

    async fetchFromDisk(locator, opts) {
      const {
        parentLocator,
        execPath
      } = this.parseLocator(locator); // If the file target is an absolute path we can directly access it via its
      // location on the disk. Otherwise we must go through the package fs.

      const parentFetch = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].isAbsolute(execPath) ? {
        packageFs: new _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["NodeFS"](),
        prefixPath: _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["PortablePath"].root,
        localPath: _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["PortablePath"].root
      } : await opts.fetcher.fetch(parentLocator, opts); // If the package fs publicized its "original location" (for example like
      // in the case of "file:" packages), we use it to derive the real location.

      const effectiveParentFetch = parentFetch.localPath ? {
        packageFs: new _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["NodeFS"](),
        prefixPath: parentFetch.localPath
      } : parentFetch; // Discard the parent fs unless we really need it to access the files

      if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs) parentFetch.releaseFs();
      const generatorFs = effectiveParentFetch.packageFs;
      const generatorPath = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].resolve(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].resolve(generatorFs.getRealPath(), effectiveParentFetch.prefixPath), execPath); // Execute the specified script in the temporary directory

      const cwd = await this.generatePackage(locator, generatorPath, opts); // Make sure the script generated the package

      if (!_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["xfs"].existsSync(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].join(cwd, Object(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["toFilename"])(`build`)))) throw new Error(`The script should have generated a build directory`);
      return await _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["tgzUtils"].makeArchiveFromDirectory(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].join(cwd, Object(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["toFilename"])(`build`)), {
        prefixPath: _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].getIdentVendorPath(locator)
      });
    }

    async generatePackage(locator, generatorPath, opts) {
      const _ref2 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

      const cwd = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["npath"].toPortablePath(_ref2.dirSync().name);
      const env = await _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["scriptUtils"].makeScriptEnv({
        project: opts.project
      });
      const logFile = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["npath"].toPortablePath(_ref2.tmpNameSync({
        prefix: `buildfile-`,
        postfix: `.log`
      }));
      const stdin = null;
      const stdout = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["xfs"].createWriteStream(logFile);
      const stderr = stdout;
      stdout.write(`# This file contains the result of Yarn generating a package (${_yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].stringifyLocator(locator)})\n`);
      stdout.write(`\n`);
      const {
        code
      } = await _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["execUtils"].pipevp(process.execPath, [_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["npath"].fromPortablePath(generatorPath), _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].stringifyIdent(locator)], {
        cwd,
        env,
        stdin,
        stdout,
        stderr
      });
      if (code !== 0) throw new Error(`Package generation failed (exit code ${code}, logs can be found here: ${logFile})`);
      return cwd;
    }

    parseLocator(locator) {
      const qsIndex = locator.reference.indexOf(`?`);
      if (qsIndex === -1) throw new Error(`Invalid file-type locator`);
      const execPath = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].normalize(locator.reference.slice(_constants__WEBPACK_IMPORTED_MODULE_3__["PROTOCOL"].length, qsIndex));
      const queryString = querystring__WEBPACK_IMPORTED_MODULE_2___default.a.parse(locator.reference.slice(qsIndex + 1));
      if (typeof queryString.locator !== `string`) throw new Error(`Invalid file-type locator`);
      const parentLocator = _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].parseLocator(queryString.locator, true);
      return {
        parentLocator,
        execPath
      };
    }

  }

  /***/ }),
  /* 2 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 3 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/fslib");

  /***/ }),
  /* 4 */
  /***/ (function(module, exports) {

  module.exports = require("querystring");

  /***/ }),
  /* 5 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "PROTOCOL", function() { return PROTOCOL; });
  const PROTOCOL = `exec:`;

  /***/ }),
  /* 6 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ExecResolver", function() { return ExecResolver; });
  /* harmony import */ var _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
  /* harmony import */ var _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__);
  /* harmony import */ var querystring__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4);
  /* harmony import */ var querystring__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(querystring__WEBPACK_IMPORTED_MODULE_1__);
  /* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5);



  class ExecResolver {
    supportsDescriptor(descriptor, opts) {
      if (!descriptor.range.startsWith(_constants__WEBPACK_IMPORTED_MODULE_2__["PROTOCOL"])) return false;
      return true;
    }

    supportsLocator(locator, opts) {
      if (!locator.reference.startsWith(_constants__WEBPACK_IMPORTED_MODULE_2__["PROTOCOL"])) return false;
      return true;
    }

    shouldPersistResolution(locator, opts) {
      return false;
    }

    bindDescriptor(descriptor, fromLocator, opts) {
      if (descriptor.range.includes(`?`)) return descriptor;
      return _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].makeDescriptor(descriptor, `${descriptor.range}?${querystring__WEBPACK_IMPORTED_MODULE_1___default.a.stringify({
        locator: _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].stringifyLocator(fromLocator)
      })}`);
    }

    async getCandidates(descriptor, opts) {
      const _ref3 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      let path = descriptor.range;
      if (path.startsWith(_constants__WEBPACK_IMPORTED_MODULE_2__["PROTOCOL"])) path = path.slice(_constants__WEBPACK_IMPORTED_MODULE_2__["PROTOCOL"].length);
      return [_yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["structUtils"].makeLocator(descriptor, `${_constants__WEBPACK_IMPORTED_MODULE_2__["PROTOCOL"]}${_ref3.npath.toPortablePath(path)}`)];
    }

    async resolve(locator, opts) {
      const _ref2 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 2, 7));

      const _ref = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 2, 7));

      if (!opts.fetchOptions) throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);
      const packageFetch = await opts.fetchOptions.fetcher.fetch(locator, opts.fetchOptions);
      const manifest = await _yarnpkg_core__WEBPACK_IMPORTED_MODULE_0__["miscUtils"].releaseAfterUseAsync(async () => {
        return await _ref.Manifest.find(packageFetch.prefixPath, {
          baseFs: packageFetch.packageFs
        });
      }, packageFetch.releaseFs);
      return Object.assign(Object.assign({}, locator), {
        version: manifest.version || `0.0.0`,
        languageName: opts.project.configuration.get(`defaultLanguageName`),
        linkType: _ref2.LinkType.HARD,
        dependencies: manifest.dependencies,
        peerDependencies: manifest.peerDependencies,
        dependenciesMeta: manifest.dependenciesMeta,
        peerDependenciesMeta: manifest.peerDependenciesMeta,
        bin: manifest.bin
      });
    }

  }

  /***/ }),
  /* 7 */
  /***/ (function(module, exports) {

  module.exports = require("tmp");

  /***/ })
  /******/ ]);
  return plugin;
};

module.exports.name = "@yarnpkg/plugin-exec";
