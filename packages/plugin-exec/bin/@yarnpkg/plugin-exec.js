/* eslint-disable*/
module.exports = {
  name: "@yarnpkg/plugin-exec",
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


  var __importStar = this && this.__importStar || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
  };

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const ExecFetcher_1 = __webpack_require__(1);

  const ExecResolver_1 = __webpack_require__(6);

  const execUtils = __importStar(__webpack_require__(5));

  exports.execUtils = execUtils;
  const plugin = {
    fetchers: [ExecFetcher_1.ExecFetcher],
    resolvers: [ExecResolver_1.ExecResolver]
  }; // eslint-disable-next-line arca/no-default-export

  exports.default = plugin;

  /***/ }),
  /* 1 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(2);

  const core_2 = __webpack_require__(2);

  const fslib_1 = __webpack_require__(3);

  const constants_1 = __webpack_require__(4);

  const execUtils_1 = __webpack_require__(5);

  class ExecFetcher {
    supports(locator, opts) {
      if (!locator.reference.startsWith(constants_1.PROTOCOL)) return false;
      return true;
    }

    getLocalPath(locator, opts) {
      const {
        parentLocator,
        path
      } = core_1.structUtils.parseFileStyleRange(locator.reference, {
        protocol: constants_1.PROTOCOL
      });
      if (fslib_1.ppath.isAbsolute(path)) return path;
      const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);
      if (parentLocalPath === null) return null;
      return fslib_1.ppath.resolve(parentLocalPath, path);
    }

    async fetch(locator, opts) {
      const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;
      const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(locator, expectedChecksum, async () => {
        opts.report.reportInfoOnce(core_2.MessageName.FETCH_NOT_CACHED, `${core_1.structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.fetchFromDisk(locator, opts);
      });
      return {
        packageFs,
        releaseFs,
        prefixPath: core_1.structUtils.getIdentVendorPath(locator),
        localPath: this.getLocalPath(locator, opts),
        checksum
      };
    }

    async fetchFromDisk(locator, opts) {
      const generatorFile = await execUtils_1.loadGeneratorFile(locator.reference, constants_1.PROTOCOL, opts);
      return fslib_1.xfs.mktempPromise(async generatorDir => {
        const generatorPath = fslib_1.ppath.join(generatorDir, fslib_1.toFilename(`generator.js`));
        await fslib_1.xfs.writeFilePromise(generatorPath, generatorFile);
        return fslib_1.xfs.mktempPromise(async cwd => {
          // Execute the specified script in the temporary directory
          await this.generatePackage(cwd, locator, generatorPath, opts); // Make sure the script generated the package

          if (!fslib_1.xfs.existsSync(fslib_1.ppath.join(cwd, fslib_1.toFilename(`build`)))) throw new Error(`The script should have generated a build directory`);
          return await core_1.tgzUtils.makeArchiveFromDirectory(fslib_1.ppath.join(cwd, fslib_1.toFilename(`build`)), {
            prefixPath: core_1.structUtils.getIdentVendorPath(locator),
            compressionLevel: opts.project.configuration.get('compressionLevel')
          });
        });
      });
    }

    async generatePackage(cwd, locator, generatorPath, opts) {
      return await fslib_1.xfs.mktempPromise(async binFolder => {
        const env = await core_1.scriptUtils.makeScriptEnv({
          project: opts.project,
          binFolder
        });
        const envFile = fslib_1.ppath.join(cwd, `environment.js`);
        return await fslib_1.xfs.mktempPromise(async logDir => {
          const logFile = fslib_1.ppath.join(logDir, `buildfile.log`);
          const stdin = null;
          const stdout = fslib_1.xfs.createWriteStream(logFile);
          const stderr = stdout;
          const tempDir = fslib_1.ppath.join(cwd, `generator`);
          const buildDir = fslib_1.ppath.join(cwd, `build`);
          await fslib_1.xfs.mkdirPromise(tempDir);
          await fslib_1.xfs.mkdirPromise(buildDir);
          /**
           * Values exposed on the global `execEnv` variable.
           *
           * Must be stringifiable using `JSON.stringify`.
           */

          const execEnvValues = {
            tempDir: fslib_1.npath.fromPortablePath(tempDir),
            buildDir: fslib_1.npath.fromPortablePath(buildDir),
            locator: core_1.structUtils.stringifyLocator(locator)
          };
          await fslib_1.xfs.writeFilePromise(envFile, `
            // Expose 'Module' as a global variable
            Object.defineProperty(global, 'Module', {
              get: () => require('module'),
              enumerable: false,
            });

            // Expose non-hidden built-in modules as global variables
            for (const name of Module.builtinModules.filter((name) => name !== 'module' && !name.startsWith('_'))) {
              Object.defineProperty(global, name, {
                get: () => require(name),
                enumerable: false,
              });
            }

            // Expose the 'execEnv' global variable
            Object.defineProperty(global, 'execEnv', {
              value: {
                ...${JSON.stringify(execEnvValues)},
              },
              enumerable: true,
            });
          `);
          const envRequire = `--require ${fslib_1.npath.fromPortablePath(envFile)}`;
          let NODE_OPTIONS = env.NODE_OPTIONS || ``;
          NODE_OPTIONS = NODE_OPTIONS ? `${NODE_OPTIONS} ${envRequire}` : envRequire;
          env.NODE_OPTIONS = NODE_OPTIONS;
          stdout.write(`# This file contains the result of Yarn generating a package (${core_1.structUtils.stringifyLocator(locator)})\n`);
          stdout.write(`\n`);
          const {
            code
          } = await core_1.execUtils.pipevp(process.execPath, [fslib_1.npath.fromPortablePath(generatorPath), core_1.structUtils.stringifyIdent(locator)], {
            cwd,
            env,
            stdin,
            stdout,
            stderr
          });

          if (code !== 0) {
            fslib_1.xfs.detachTemp(logDir);
            throw new Error(`Package generation failed (exit code ${code}, logs can be found here: ${logFile})`);
          }
        });
      });
    }

  }

  exports.ExecFetcher = ExecFetcher;

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
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.PROTOCOL = `exec:`;

  /***/ }),
  /* 5 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(2);

  const fslib_1 = __webpack_require__(3);

  function parseSpec(spec) {
    const {
      params,
      selector
    } = core_1.structUtils.parseRange(spec);
    const path = fslib_1.npath.toPortablePath(selector);
    const parentLocator = params && typeof params.locator === `string` ? core_1.structUtils.parseLocator(params.locator) : null;
    return {
      parentLocator,
      path
    };
  }

  exports.parseSpec = parseSpec;

  function makeSpec({
    parentLocator,
    path,
    generatorHash,
    protocol
  }) {
    const parentLocatorSpread = parentLocator !== null ? {
      locator: core_1.structUtils.stringifyLocator(parentLocator)
    } : {};
    const generatorHashSpread = typeof generatorHash !== `undefined` ? {
      hash: generatorHash
    } : {};
    return core_1.structUtils.makeRange({
      protocol: protocol,
      source: path,
      selector: path,
      params: Object.assign(Object.assign({}, generatorHashSpread), parentLocatorSpread)
    });
  }

  exports.makeSpec = makeSpec;

  function makeLocator(ident, {
    parentLocator,
    path,
    generatorHash,
    protocol
  }) {
    return core_1.structUtils.makeLocator(ident, makeSpec({
      parentLocator,
      path,
      generatorHash,
      protocol
    }));
  }

  exports.makeLocator = makeLocator;

  async function loadGeneratorFile(range, protocol, opts) {
    const {
      parentLocator,
      path
    } = core_1.structUtils.parseFileStyleRange(range, {
      protocol
    }); // If the file target is an absolute path we can directly access it via its
    // location on the disk. Otherwise we must go through the package fs.

    const parentFetch = fslib_1.ppath.isAbsolute(path) ? {
      packageFs: new fslib_1.NodeFS(),
      prefixPath: fslib_1.PortablePath.root,
      localPath: fslib_1.PortablePath.root
    } : await opts.fetcher.fetch(parentLocator, opts); // If the package fs publicized its "original location" (for example like
    // in the case of "file:" packages), we use it to derive the real location.

    const effectiveParentFetch = parentFetch.localPath ? {
      packageFs: new fslib_1.NodeFS(),
      prefixPath: parentFetch.localPath
    } : parentFetch; // Discard the parent fs unless we really need it to access the files

    if (parentFetch !== effectiveParentFetch && parentFetch.releaseFs) parentFetch.releaseFs();
    const generatorFs = effectiveParentFetch.packageFs;
    return await generatorFs.readFilePromise(path, `utf8`);
  }

  exports.loadGeneratorFile = loadGeneratorFile;

  /***/ }),
  /* 6 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  var __importStar = this && this.__importStar || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
  };

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const core_1 = __webpack_require__(2);

  const core_2 = __webpack_require__(2);

  const core_3 = __webpack_require__(2);

  const constants_1 = __webpack_require__(4);

  const execUtils = __importStar(__webpack_require__(5)); // We use this for the generators to be regenerated without bumping the whole cache


  const CACHE_VERSION = 1;

  class ExecResolver {
    supportsDescriptor(descriptor, opts) {
      if (!descriptor.range.startsWith(constants_1.PROTOCOL)) return false;
      return true;
    }

    supportsLocator(locator, opts) {
      if (!locator.reference.startsWith(constants_1.PROTOCOL)) return false;
      return true;
    }

    shouldPersistResolution(locator, opts) {
      return false;
    }

    bindDescriptor(descriptor, fromLocator, opts) {
      return core_3.structUtils.bindDescriptor(descriptor, {
        locator: core_3.structUtils.stringifyLocator(fromLocator)
      });
    }

    getResolutionDependencies(descriptor, opts) {
      return [];
    }

    async getCandidates(descriptor, dependencies, opts) {
      if (!opts.fetchOptions) throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);
      const {
        path,
        parentLocator
      } = execUtils.parseSpec(descriptor.range);
      const generatorFile = await execUtils.loadGeneratorFile(core_3.structUtils.makeRange({
        protocol: constants_1.PROTOCOL,
        source: path,
        selector: path,
        params: {
          // The Descriptor should already be bound
          locator: core_3.structUtils.stringifyLocator(parentLocator)
        }
      }), constants_1.PROTOCOL, opts.fetchOptions);
      const generatorHash = core_3.hashUtils.makeHash(`${CACHE_VERSION}`, generatorFile).slice(0, 6);
      return [execUtils.makeLocator(descriptor, {
        parentLocator,
        path,
        generatorHash,
        protocol: constants_1.PROTOCOL
      })];
    }

    async resolve(locator, opts) {
      if (!opts.fetchOptions) throw new Error(`Assertion failed: This resolver cannot be used unless a fetcher is configured`);
      const packageFetch = await opts.fetchOptions.fetcher.fetch(locator, opts.fetchOptions);
      const manifest = await core_3.miscUtils.releaseAfterUseAsync(async () => {
        return await core_1.Manifest.find(packageFetch.prefixPath, {
          baseFs: packageFetch.packageFs
        });
      }, packageFetch.releaseFs);
      return Object.assign(Object.assign({}, locator), {
        version: manifest.version || `0.0.0`,
        languageName: opts.project.configuration.get(`defaultLanguageName`),
        linkType: core_2.LinkType.HARD,
        dependencies: manifest.dependencies,
        peerDependencies: manifest.peerDependencies,
        dependenciesMeta: manifest.dependenciesMeta,
        peerDependenciesMeta: manifest.peerDependenciesMeta,
        bin: manifest.bin
      });
    }

  }

  exports.ExecResolver = ExecResolver;

  /***/ })
  /******/ ]);
    return plugin;
  },
};
