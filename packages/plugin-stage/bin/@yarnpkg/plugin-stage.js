/* eslint-disable*/
module.exports = {
  name: "@yarnpkg/plugin-stage",
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


  var __importDefault = this && this.__importDefault || function (mod) {
    return mod && mod.__esModule ? mod : {
      "default": mod
    };
  };

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const stage_1 = __importDefault(__webpack_require__(1));

  const plugin = {
    commands: [stage_1.default]
  }; // eslint-disable-next-line arca/no-default-export

  exports.default = plugin;

  /***/ }),
  /* 1 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  var __decorate = this && this.__decorate || function (decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
        d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const cli_1 = __webpack_require__(2);

  const core_1 = __webpack_require__(3);

  const fslib_1 = __webpack_require__(4);

  const clipanion_1 = __webpack_require__(5);

  const GitDriver_1 = __webpack_require__(6);

  const MercurialDriver_1 = __webpack_require__(8);

  const ALL_DRIVERS = [GitDriver_1.Driver, MercurialDriver_1.Driver]; // eslint-disable-next-line arca/no-default-export

  class StageCommand extends cli_1.BaseCommand {
    constructor() {
      super(...arguments);
      this.commit = false;
      this.reset = false;
      this.update = false;
      this.dryRun = false;
    }

    async execute() {
      const configuration = await core_1.Configuration.find(this.context.cwd, this.context.plugins);
      const {
        project
      } = await core_1.Project.find(configuration, this.context.cwd);
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
            this.context.stdout.write(`${fslib_1.npath.fromPortablePath(file.path)}\n`);
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

  StageCommand.usage = clipanion_1.Command.Usage({
    description: `add all yarn files to your vcs`,
    details: `
        This command will add to your staging area the files belonging to Yarn (typically any modified \`package.json\` and \`.yarnrc.yml\` files, but also linker-generated files, cache data, etc). It will take your ignore list into account, so the cache files won't be added if the cache is ignored in a \`.gitignore\` file (assuming you use Git).

        Running \`--reset\` will instead remove them from the staging area (the changes will still be there, but won't be committed until you stage them back).

        Since the staging area is a non-existent concept in Mercurial, Yarn will always create a new commit when running this command on Mercurial repositories. You can get this behavior when using Git by using the \`--commit\` flag which will directly create a commit.
      `,
    examples: [[`Adds all modified project files to the staging area`, `yarn stage`], [`Creates a new commit containing all modified project files`, `yarn stage --commit`]]
  });

  __decorate([clipanion_1.Command.Boolean(`-c,--commit`)], StageCommand.prototype, "commit", void 0);

  __decorate([clipanion_1.Command.Boolean(`-r,--reset`)], StageCommand.prototype, "reset", void 0);

  __decorate([clipanion_1.Command.Boolean(`-u,--update`)], StageCommand.prototype, "update", void 0);

  __decorate([clipanion_1.Command.Boolean(`-n,--dry-run`)], StageCommand.prototype, "dryRun", void 0);

  __decorate([clipanion_1.Command.Path(`stage`)], StageCommand.prototype, "execute", null);

  exports.default = StageCommand;

  async function findDriver(cwd) {
    let driver = null;
    let root = null;

    for (const candidate of ALL_DRIVERS) {
      if ((root = await candidate.findRoot(cwd)) !== null) {
        driver = candidate;
        break;
      }
    }

    if (driver === null || root === null) throw new clipanion_1.UsageError(`No stage driver has been found for your current project`);
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
        stat = fslib_1.xfs.statSync(path);
      } catch (error) {
        // ignore errors
        break;
      } // If it's a symbolic link then we also need to also consider its target as
      // part of the Yarn installation (unless it's outside of the repo)


      if (stat.isSymbolicLink()) {
        path = fslib_1.ppath.resolve(fslib_1.ppath.dirname(path), fslib_1.xfs.readlinkSync(path));
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

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 4 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/fslib");

  /***/ }),
  /* 5 */
  /***/ (function(module, exports) {

  module.exports = require("clipanion");

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

  const core_1 = __webpack_require__(3);

  const fslib_1 = __webpack_require__(4);

  const stageUtils = __importStar(__webpack_require__(7));

  const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
  const COMMIT_DEPTH = 11;

  async function getLastCommitHash(cwd) {
    const {
      code,
      stdout
    } = await core_1.execUtils.execvp(`git`, [`log`, `-1`, `--pretty=format:%H`], {
      cwd
    });

    if (code === 0) {
      return stdout.trim();
    } else {
      return null;
    }
  }

  async function genCommitMessage(cwd, changes) {
    const actions = [];
    const modifiedPkgJsonFiles = changes.filter(change => {
      return fslib_1.ppath.basename(change.path) === `package.json`;
    });

    for (const {
      action,
      path
    } of modifiedPkgJsonFiles) {
      const relativePath = fslib_1.ppath.relative(cwd, path);

      if (action === stageUtils.ActionType.MODIFY) {
        const commitHash = await getLastCommitHash(cwd);
        const {
          stdout: prevSource
        } = await core_1.execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {
          cwd,
          strict: true
        });
        const prevManifest = await core_1.Manifest.fromText(prevSource);
        const currManifest = await core_1.Manifest.fromFile(path);
        const allCurrDeps = new Map([...currManifest.dependencies, ...currManifest.devDependencies]);
        const allPrevDeps = new Map([...prevManifest.dependencies, ...prevManifest.devDependencies]);

        for (const [indentHash, value] of allPrevDeps) {
          const pkgName = core_1.structUtils.stringifyIdent(value);
          const currDep = allCurrDeps.get(indentHash);

          if (!currDep) {
            actions.push([stageUtils.ActionType.REMOVE, pkgName]);
          } else if (currDep.range !== value.range) {
            actions.push([stageUtils.ActionType.MODIFY, `${pkgName} to ${currDep.range}`]);
          }
        }

        for (const [indentHash, value] of allCurrDeps) {
          if (!allPrevDeps.has(indentHash)) {
            actions.push([stageUtils.ActionType.ADD, core_1.structUtils.stringifyIdent(value)]);
          }
        }
      } else if (action === stageUtils.ActionType.CREATE) {
        // New package.json
        const manifest = await core_1.Manifest.fromFile(path);

        if (manifest.name) {
          actions.push([stageUtils.ActionType.CREATE, core_1.structUtils.stringifyIdent(manifest.name)]);
        } else {
          actions.push([stageUtils.ActionType.CREATE, `a package`]);
        }
      } else if (action === stageUtils.ActionType.DELETE) {
        const commitHash = await getLastCommitHash(cwd);
        const {
          stdout: prevSource
        } = await core_1.execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {
          cwd,
          strict: true
        }); // Deleted package.json; we need to load it from its past sources

        const manifest = await core_1.Manifest.fromText(prevSource);

        if (manifest.name) {
          actions.push([stageUtils.ActionType.DELETE, core_1.structUtils.stringifyIdent(manifest.name)]);
        } else {
          actions.push([stageUtils.ActionType.DELETE, `a package`]);
        }
      } else {
        throw new Error(`Assertion failed: Unsupported action type`);
      }
    }

    const {
      code,
      stdout
    } = await core_1.execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {
      cwd
    });
    const lines = code === 0 ? stdout.split(/\n/g).filter(line => line !== ``) : [];
    const consensus = stageUtils.findConsensus(lines);
    const message = stageUtils.genCommitMessage(consensus, actions);
    return message;
  }

  exports.Driver = {
    async findRoot(cwd) {
      return await stageUtils.findVcsRoot(cwd, {
        marker: fslib_1.toFilename(`.git`)
      });
    },

    async filterChanges(cwd, yarnRoots, yarnNames) {
      const {
        stdout
      } = await core_1.execUtils.execvp(`git`, [`status`, `-s`], {
        cwd,
        strict: true
      });
      const lines = stdout.toString().split(/\n/g);
      const changes = [].concat(...lines.map(line => {
        if (line === ``) return [];
        const prefix = line.slice(0, 3);
        const path = fslib_1.ppath.resolve(cwd, line.slice(3)); // New directories need to be expanded to their content

        if (prefix === `?? ` && line.endsWith(`/`)) {
          return stageUtils.expandDirectory(path).map(path => ({
            action: stageUtils.ActionType.CREATE,
            path
          }));
        } else if (prefix === ` A ` || prefix === `?? `) {
          return [{
            action: stageUtils.ActionType.CREATE,
            path
          }];
        } else if (prefix === ` M `) {
          return [{
            action: stageUtils.ActionType.MODIFY,
            path
          }];
        } else if (prefix === ` D `) {
          return [{
            action: stageUtils.ActionType.DELETE,
            path
          }];
        } else {
          return [];
        }
      }));
      return changes.filter(change => {
        return stageUtils.isYarnFile(change.path, {
          roots: yarnRoots,
          names: yarnNames
        });
      });
    },

    async genCommitMessage(cwd, changeList) {
      return await genCommitMessage(cwd, changeList);
    },

    async makeCommit(cwd, changeList, commitMessage) {
      const localPaths = changeList.map(file => fslib_1.npath.fromPortablePath(file.path));
      await core_1.execUtils.execvp(`git`, [`add`, `-N`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
      await core_1.execUtils.execvp(`git`, [`commit`, `-m`, `${commitMessage}\n\n${MESSAGE_MARKER}\n`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
    },

    async makeReset(cwd, changeList) {
      const localPaths = changeList.map(path => fslib_1.npath.fromPortablePath(path.path));
      await core_1.execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ...localPaths], {
        cwd,
        strict: true
      });
    }

  };

  /***/ }),
  /* 7 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  const fslib_1 = __webpack_require__(4);

  var ActionType;

  (function (ActionType) {
    ActionType[ActionType["CREATE"] = 0] = "CREATE";
    ActionType[ActionType["DELETE"] = 1] = "DELETE";
    ActionType[ActionType["ADD"] = 2] = "ADD";
    ActionType[ActionType["REMOVE"] = 3] = "REMOVE";
    ActionType[ActionType["MODIFY"] = 4] = "MODIFY";
  })(ActionType = exports.ActionType || (exports.ActionType = {}));

  ;

  async function findVcsRoot(cwd, {
    marker
  }) {
    do {
      if (!fslib_1.xfs.existsSync(fslib_1.ppath.join(cwd, marker))) {
        cwd = fslib_1.ppath.dirname(cwd);
      } else {
        return cwd;
      }
    } while (cwd !== `/`);

    return null;
  }

  exports.findVcsRoot = findVcsRoot;

  function isYarnFile(path, {
    roots,
    names
  }) {
    if (names.has(fslib_1.ppath.basename(path))) return true;

    do {
      if (!roots.has(path)) {
        path = fslib_1.ppath.dirname(path);
      } else {
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
        const path = fslib_1.ppath.resolve(cwd, entry);
        const stat = fslib_1.xfs.lstatSync(path);

        if (stat.isDirectory()) {
          cwds.push(path);
        } else {
          paths.push(path);
        }
      }
    }

    return paths;
  }

  exports.expandDirectory = expandDirectory;

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

  exports.checkConsensus = checkConsensus;

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

  exports.findConsensus = findConsensus;

  function getCommitPrefix(consensus) {
    if (consensus.useComponent) {
      return `chore(yarn): `;
    } else {
      return ``;
    }
  }

  exports.getCommitPrefix = getCommitPrefix;
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

  exports.genCommitMessage = genCommitMessage;

  /***/ }),
  /* 8 */
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

  const fslib_1 = __webpack_require__(4);

  const stageUtils = __importStar(__webpack_require__(7));

  exports.Driver = {
    async findRoot(cwd) {
      return await stageUtils.findVcsRoot(cwd, {
        marker: fslib_1.toFilename(`.hg`)
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

  /***/ })
  /******/ ]);
    return plugin;
  },
};
