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
  /******/ 	// The chunk loading function for additional chunks
  /******/ 	// Since all referenced chunks are already included
  /******/ 	// in this file, this function is empty here.
  /******/ 	__webpack_require__.e = function requireEnsure() {
  /******/ 		return Promise.resolve();
  /******/ 	};
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
  /* harmony import */ var _commands_stage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);

  const plugin = {
    commands: [_commands_stage__WEBPACK_IMPORTED_MODULE_0__["default"]]
  }; // eslint-disable-next-line arca/no-default-export

  /* harmony default export */ __webpack_exports__["default"] = (plugin);

  /***/ }),
  /* 1 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return StageCommand; });
  /* harmony import */ var _yarnpkg_cli__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
  /* harmony import */ var _yarnpkg_cli__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_cli__WEBPACK_IMPORTED_MODULE_0__);
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__);
  /* harmony import */ var clipanion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
  /* harmony import */ var clipanion__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(clipanion__WEBPACK_IMPORTED_MODULE_2__);
  /* harmony import */ var _drivers_GitDriver__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(5);
  /* harmony import */ var _drivers_MercurialDriver__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(6);
  var __decorate = undefined && undefined.__decorate || function (decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
        d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };






  const ALL_DRIVERS = [_drivers_GitDriver__WEBPACK_IMPORTED_MODULE_3__["Driver"], _drivers_MercurialDriver__WEBPACK_IMPORTED_MODULE_4__["Driver"]]; // eslint-disable-next-line arca/no-default-export

  class StageCommand extends _yarnpkg_cli__WEBPACK_IMPORTED_MODULE_0__["BaseCommand"] {
    constructor() {
      super(...arguments);
      this.commit = false;
      this.reset = false;
      this.update = false;
      this.dryRun = false;
    }

    async execute() {
      const _ref = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

      const configuration = await _ref.Configuration.find(this.context.cwd, this.context.plugins);
      const {
        project
      } = await _ref.Project.find(configuration, this.context.cwd);
      let {
        driver,
        root
      } = await findDriver(project.cwd);
      const basePaths = [configuration.get(`bstatePath`), configuration.get(`cacheFolder`), configuration.get(`globalFolder`), configuration.get(`virtualFolder`), configuration.get(`yarnPath`)];
      await configuration.triggerHook(hooks => {
        return hooks.populateYarnPaths;
      }, project, path => {
        basePaths.push(path);
      });
      const yarnPaths = new Set(); // We try to follow symlinks to properly add their targets (for example
      // the cache folder could be a symlink to another folder from the repo)

      for (const basePath of basePaths) for (const path of resolveToVcs(root, basePath)) yarnPaths.add(path);

      const yarnNames = new Set([configuration.get(`rcFilename`), configuration.get(`lockfileFilename`), `package.json`]);
      const changeList = await driver.filterChanges(root, yarnPaths, yarnNames);
      const commitMessage = await driver.genCommitMessage(root, changeList);

      if (this.dryRun) {
        if (this.commit) {
          this.context.stdout.write(`${commitMessage}\n`);
        } else {
          for (const file of changeList) {
            this.context.stdout.write(`${_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["NodeFS"].fromPortablePath(file.path)}\n`);
          }
        }
      } else {
        if (changeList.length === 0) {
          this.context.stdout.write(`No changes found!`);
        } else if (this.commit) {
          await driver.makeCommit(root, changeList, commitMessage);
        } else if (this.reset) {
          await driver.makeReset(root, changeList);
        }
      }
    }

  }
  StageCommand.usage = clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Usage({
    description: `add all yarn files to your vcs`,
    details: `
        This command will add to your staging area the files belonging to Yarn (typically any modified \`package.json\` and \`.yarnrc.yml\` files, but also linker-generated files, cache data, etc). It will take your ignore list into account, so the cache files won't be added if the cache is ignored in a \`.gitignore\` file (assuming you use Git).

        Running \`--reset\` will instead remove them from the staging area (the changes will still be there, but won't be committed until you stage them back).

        Since the staging area is a non-existent concept in Mercurial, Yarn will always create a new commit when running this command on Mercurial repositories. You can get this behavior when using Git by using the \`--commit\` flag which will directly create a commit.
      `,
    examples: [[`Adds all modified project files to the staging area`, `yarn stage`], [`Creates a new commit containing all modified project files`, `yarn stage --commit`]]
  });

  __decorate([clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Boolean(`-c,--commit`)], StageCommand.prototype, "commit", void 0);

  __decorate([clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Boolean(`-r,--reset`)], StageCommand.prototype, "reset", void 0);

  __decorate([clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Boolean(`-u,--update`)], StageCommand.prototype, "update", void 0);

  __decorate([clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Boolean(`-n,--dry-run`)], StageCommand.prototype, "dryRun", void 0);

  __decorate([clipanion__WEBPACK_IMPORTED_MODULE_2__["Command"].Path(`stage`)], StageCommand.prototype, "execute", null);

  async function findDriver(cwd) {
    let driver = null;
    let root = null;

    for (const candidate of ALL_DRIVERS) {
      if ((root = await candidate.findRoot(cwd)) !== null) {
        driver = candidate;
        break;
      }
    }

    if (driver === null || root === null) throw new clipanion__WEBPACK_IMPORTED_MODULE_2__["UsageError"](`No stage driver has been found for your current project`);
    return {
      driver,
      root
    };
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
    if (path === null) return resolved;

    while (true) {
      // If the current element is within the repository, we flag it as something
      // that's part of the Yarn installation
      if (path === cwd || path.startsWith(`${cwd}/`)) resolved.push(path);
      let stat;

      try {
        stat = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["xfs"].statSync(path);
      } catch (error) {
        // ignore errors
        break;
      } // If it's a symbolic link then we also need to also consider its target as
      // part of the Yarn installation (unless it's outside of the repo)


      if (stat.isSymbolicLink()) {
        path = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].resolve(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["ppath"].dirname(path), _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_1__["xfs"].readlinkSync(path));
      } else {
        break;
      }
    }

    return resolved;
  }

  /***/ }),
  /* 2 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/cli");

  /***/ }),
  /* 3 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/fslib");

  /***/ }),
  /* 4 */
  /***/ (function(module, exports) {

  module.exports = require("clipanion");

  /***/ }),
  /* 5 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Driver", function() { return Driver; });
  function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

  const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
  const COMMIT_DEPTH = 11;

  async function getLastCommitHash(cwd) {
    const _ref = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

    const {
      code,
      stdout
    } = await _ref.execUtils.execvp(`git`, [`log`, `-1`, `--pretty=format:%H`], {
      cwd
    });

    if (code === 0) {
      return stdout.trim();
    } else {
      return null;
    }
  }

  async function genCommitMessage(cwd, changes) {
    const _ref11 = await Promise.resolve(/* import() */).then(__webpack_require__.bind(null, 8));

    const _ref8 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

    const _ref2 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

    const actions = [];
    const modifiedPkgJsonFiles = changes.filter(change => {
      return _ref8.ppath.basename(change.path) === `package.json`;
    });

    for (const {
      action,
      path
    } of modifiedPkgJsonFiles) {
      const relativePath = _ref8.ppath.relative(cwd, path);

      if (action === _interopRequireWildcard(_ref11).ActionType.MODIFY) {
        const commitHash = await getLastCommitHash(cwd);
        const {
          stdout: prevSource
        } = await _ref2.execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {
          cwd,
          strict: true
        });
        const prevManifest = await _ref2.Manifest.fromText(prevSource);
        const currManifest = await _ref2.Manifest.fromFile(path);
        const allCurrDeps = new Map([...currManifest.dependencies, ...currManifest.devDependencies]);
        const allPrevDeps = new Map([...prevManifest.dependencies, ...prevManifest.devDependencies]);

        for (const [indentHash, value] of allPrevDeps) {
          const pkgName = _ref2.structUtils.stringifyIdent(value);

          const currDep = allCurrDeps.get(indentHash);

          if (!currDep) {
            actions.push([_interopRequireWildcard(_ref11).ActionType.REMOVE, pkgName]);
          } else if (currDep.range !== value.range) {
            actions.push([_interopRequireWildcard(_ref11).ActionType.MODIFY, `${pkgName} to ${currDep.range}`]);
          }
        }

        for (const [indentHash, value] of allCurrDeps) {
          if (!allPrevDeps.has(indentHash)) {
            actions.push([_interopRequireWildcard(_ref11).ActionType.ADD, _ref2.structUtils.stringifyIdent(value)]);
          }
        }
      } else if (action === _interopRequireWildcard(_ref11).ActionType.CREATE) {
        // New package.json
        const manifest = await _ref2.Manifest.fromFile(path);

        if (manifest.name) {
          actions.push([_interopRequireWildcard(_ref11).ActionType.CREATE, _ref2.structUtils.stringifyIdent(manifest.name)]);
        } else {
          actions.push([_interopRequireWildcard(_ref11).ActionType.CREATE, `a package`]);
        }
      } else if (action === _interopRequireWildcard(_ref11).ActionType.DELETE) {
        const commitHash = await getLastCommitHash(cwd);
        const {
          stdout: prevSource
        } = await _ref2.execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {
          cwd,
          strict: true
        }); // Deleted package.json; we need to load it from its past sources

        const manifest = await _ref2.Manifest.fromText(prevSource);

        if (manifest.name) {
          actions.push([_interopRequireWildcard(_ref11).ActionType.DELETE, _ref2.structUtils.stringifyIdent(manifest.name)]);
        } else {
          actions.push([_interopRequireWildcard(_ref11).ActionType.DELETE, `a package`]);
        }
      } else {
        throw new Error(`Assertion failed: Unsupported action type`);
      }
    }

    const {
      code,
      stdout
    } = await _ref2.execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {
      cwd
    });
    const lines = code === 0 ? stdout.split(/\n/g).filter(line => line !== ``) : [];

    const consensus = _interopRequireWildcard(_ref11).findConsensus(lines);

    const message = _interopRequireWildcard(_ref11).genCommitMessage(consensus, actions);

    return message;
  }

  const Driver = {
    async findRoot(cwd) {
      const _ref12 = await Promise.resolve(/* import() */).then(__webpack_require__.bind(null, 8));

      const _ref10 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      return await _interopRequireWildcard(_ref12).findVcsRoot(cwd, {
        marker: _ref10.toFilename(`.git`)
      });
    },

    async filterChanges(cwd, yarnRoots, yarnNames) {
      const _ref13 = await Promise.resolve(/* import() */).then(__webpack_require__.bind(null, 8));

      const _ref9 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      const _ref3 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

      const {
        stdout
      } = await _ref3.execUtils.execvp(`git`, [`status`, `-s`], {
        cwd,
        strict: true
      });
      const lines = stdout.toString().split(/\n/g);
      const changes = [].concat(...lines.map(line => {
        if (line === ``) return [];
        const prefix = line.slice(0, 3);

        const path = _ref9.ppath.resolve(cwd, line.slice(3)); // New directories need to be expanded to their content


        if (prefix === `?? ` && line.endsWith(`/`)) {
          return _interopRequireWildcard(_ref13).expandDirectory(path).map(path => ({
            action: _interopRequireWildcard(_ref13).ActionType.CREATE,
            path
          }));
        } else if (prefix === ` A ` || prefix === `?? `) {
          return [{
            action: _interopRequireWildcard(_ref13).ActionType.CREATE,
            path
          }];
        } else if (prefix === ` M `) {
          return [{
            action: _interopRequireWildcard(_ref13).ActionType.MODIFY,
            path
          }];
        } else if (prefix === ` D `) {
          return [{
            action: _interopRequireWildcard(_ref13).ActionType.DELETE,
            path
          }];
        } else {
          return [];
        }
      }));
      return changes.filter(change => {
        return _interopRequireWildcard(_ref13).isYarnFile(change.path, {
          roots: yarnRoots,
          names: yarnNames
        });
      });
    },

    async genCommitMessage(cwd, changeList) {
      return await genCommitMessage(cwd, changeList);
    },

    async makeCommit(cwd, changeList, commitMessage) {
      const _ref6 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      const _ref4 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

      const localPaths = changeList.map(file => _ref6.NodeFS.fromPortablePath(file.path));
      await _ref4.execUtils.execvp(`git`, [`add`, `-N`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
      await _ref4.execUtils.execvp(`git`, [`commit`, `-m`, `${commitMessage}\n\n${MESSAGE_MARKER}\n`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
    },

    async makeReset(cwd, changeList) {
      const _ref7 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      const _ref5 = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 7, 7));

      const localPaths = changeList.map(path => _ref7.NodeFS.fromPortablePath(path.path));
      await _ref5.execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
    }

  };

  /***/ }),
  /* 6 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Driver", function() { return Driver; });
  function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

  const Driver = {
    async findRoot(cwd) {
      const _ref2 = await Promise.resolve(/* import() */).then(__webpack_require__.bind(null, 8));

      const _ref = await Promise.resolve(/* import() */).then(__webpack_require__.t.bind(null, 3, 7));

      return await _interopRequireWildcard(_ref2).findVcsRoot(cwd, {
        marker: _ref.toFilename(`.hg`)
      });
    },

    async filterChanges(cwd, paths, filenames) {
      return [];
    },

    async genCommitMessage(cwd, changeList) {
      return ``;
    },

    async makeCommit(cwd, changeList, commitMessage) {},

    async makeReset(cwd, changeList) {},

    async makeUpdate(cwd, changeList) {}

  };

  /***/ }),
  /* 7 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 8 */
  /***/ (function(module, __webpack_exports__, __webpack_require__) {

  "use strict";
  __webpack_require__.r(__webpack_exports__);
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ActionType", function() { return ActionType; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findVcsRoot", function() { return findVcsRoot; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "isYarnFile", function() { return isYarnFile; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "expandDirectory", function() { return expandDirectory; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "checkConsensus", function() { return checkConsensus; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "findConsensus", function() { return findConsensus; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getCommitPrefix", function() { return getCommitPrefix; });
  /* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "genCommitMessage", function() { return genCommitMessage; });
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3);
  /* harmony import */ var _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__);

  var ActionType;

  (function (ActionType) {
    ActionType[ActionType["CREATE"] = 0] = "CREATE";
    ActionType[ActionType["DELETE"] = 1] = "DELETE";
    ActionType[ActionType["ADD"] = 2] = "ADD";
    ActionType[ActionType["REMOVE"] = 3] = "REMOVE";
    ActionType[ActionType["MODIFY"] = 4] = "MODIFY";
  })(ActionType || (ActionType = {}));

  ;
  async function findVcsRoot(cwd, {
    marker
  }) {
    do {
      if (!_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["xfs"].existsSync(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["ppath"].join(cwd, marker))) {
        cwd = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["ppath"].dirname(cwd);
      } else {
        return cwd;
      }
    } while (cwd !== `/`);

    return null;
  }
  function isYarnFile(path, {
    roots,
    names
  }) {
    if (names.has(_yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["ppath"].basename(path))) return true;

    do {
      if (!roots.has(path)) {
        path = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["ppath"].dirname(path);
      } else {
        return true;
      }
    } while (path !== `/`);

    return false;
  }
  function expandDirectory(initialCwd) {
    const paths = [];
    const cwds = [initialCwd];

    while (cwds.length > 0) {
      const cwd = cwds.pop();
      const listing = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["xfs"].readdirSync(cwd);

      for (const entry of listing) {
        const path = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["ppath"].resolve(cwd, entry);
        const stat = _yarnpkg_fslib__WEBPACK_IMPORTED_MODULE_0__["xfs"].lstatSync(path);

        if (stat.isDirectory()) {
          cwds.push(path);
        } else {
          paths.push(path);
        }
      }
    }

    return paths;
  }
  function checkConsensus(lines, regex) {
    let yes = 0,
        no = 0;

    for (const line of lines) {
      if (line === `wip`) continue;

      if (regex.test(line)) {
        yes += 1;
      } else {
        no += 1;
      }
    }

    return yes >= no;
  }
  function findConsensus(lines) {
    const useThirdPerson = checkConsensus(lines, /^(\w\(\w+\):\s*)?\w+s/);
    const useUpperCase = checkConsensus(lines, /^(\w\(\w+\):\s*)?[A-Z]/);
    const useComponent = checkConsensus(lines, /^\w\(\w+\):/);
    return {
      useThirdPerson,
      useUpperCase,
      useComponent
    };
  }
  function getCommitPrefix(consensus) {
    if (consensus.useComponent) {
      return `chore(yarn): `;
    } else {
      return ``;
    }
  }
  const VERBS = new Map([// Package actions
  [ActionType.CREATE, `create`], [ActionType.DELETE, `delete`], // File actions
  [ActionType.ADD, `add`], [ActionType.REMOVE, `remove`], [ActionType.MODIFY, `update`]]);
  function genCommitMessage(consensus, actions) {
    const prefix = getCommitPrefix(consensus);
    const all = [];
    const sorted = actions.slice().sort((a, b) => {
      return a[0] - b[0];
    });

    while (sorted.length > 0) {
      const [type, what] = sorted.shift();
      let verb = VERBS.get(type);
      if (consensus.useUpperCase && all.length === 0) verb = `${verb[0].toUpperCase()}${verb.slice(1)}`;
      if (consensus.useThirdPerson) verb += `s`;
      let subjects = [what];

      while (sorted.length > 0 && sorted[0][0] === type) {
        const [, what] = sorted.shift();
        subjects.push(what);
      }

      subjects.sort();
      let description = subjects.shift();
      if (subjects.length === 1) description += ` (and one other)`;else if (subjects.length > 1) description += ` (and ${subjects.length} others)`;
      all.push(`${verb} ${description}`);
    }

    return `${prefix}${all.join(`, `)}`;
  }

  /***/ })
  /******/ ]);
  return plugin;
};

module.exports.name = "@yarnpkg/plugin-stage";
