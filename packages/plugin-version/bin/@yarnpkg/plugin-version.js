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
  const apply_1 = __importDefault(__webpack_require__(2));
  const check_1 = __importDefault(__webpack_require__(6));
  const version_1 = __importDefault(__webpack_require__(8));
  const plugin = {
      configuration: {
          preferDeferredVersions: {
              description: `If true, running \`yarn version\` will assume the \`--deferred\` flag unless \`--immediate\` is set`,
              type: core_1.SettingsType.BOOLEAN,
              default: false,
          },
      },
      commands: [
          apply_1.default,
          check_1.default,
          version_1.default,
      ],
  };
  // eslint-disable-next-line arca/no-default-export
  exports.default = plugin;


  /***/ }),
  /* 1 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/core");

  /***/ }),
  /* 2 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";

  var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var __importDefault = (this && this.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  const cli_1 = __webpack_require__(3);
  const core_1 = __webpack_require__(1);
  const core_2 = __webpack_require__(1);
  const core_3 = __webpack_require__(1);
  const clipanion_1 = __webpack_require__(4);
  const semver_1 = __importDefault(__webpack_require__(5));
  // Basically we only support auto-upgrading the ranges that are very simple (^x.y.z, ~x.y.z, >=x.y.z, and of course x.y.z)
  const SUPPORTED_UPGRADE_REGEXP = /^(>=|[~^]|)^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;
  // eslint-disable-next-line arca/no-default-export
  class VersionApplyCommand extends cli_1.BaseCommand {
      constructor() {
          super(...arguments);
          this.all = false;
          this.json = false;
          this.dependents = false;
      }
      async execute() {
          const configuration = await core_1.Configuration.find(this.context.cwd, this.context.plugins);
          const { project, workspace } = await core_2.Project.find(configuration, this.context.cwd);
          if (!workspace)
              throw new cli_1.WorkspaceRequiredError(this.context.cwd);
          const applyReport = await core_2.StreamReport.start({
              configuration,
              json: this.json,
              stdout: this.context.stdout,
          }, async (report) => {
              const allDependents = new Map();
              // First we compute the reverse map to figure out which workspace is
              // depended upon by which other.
              //
              // Note that we need to do this before applying the new versions,
              // otherwise the `findWorkspacesByDescriptor` calls won't be able to
              // resolve the workspaces anymore (because the workspace versions will
              // have changed and won't match the outdated dependencies).
              for (const dependent of project.workspaces) {
                  for (const set of core_1.Manifest.allDependencies) {
                      for (const descriptor of dependent.manifest[set].values()) {
                          const workspaces = project.findWorkspacesByDescriptor(descriptor);
                          if (workspaces.length !== 1)
                              continue;
                          // When operating on a single workspace, we don't have to compute
                          // the dependencies for the other ones
                          const dependency = workspaces[0];
                          if (!this.all && dependency !== workspace)
                              continue;
                          let dependents = allDependents.get(dependency);
                          if (typeof dependents === `undefined`)
                              allDependents.set(dependency, dependents = []);
                          dependents.push([dependent, set, descriptor.identHash]);
                      }
                  }
              }
              // First a quick sanity check before we start modifying stuff
              const validateWorkspace = (workspace) => {
                  const nextVersion = workspace.manifest.raw.nextVersion;
                  if (typeof nextVersion === `undefined`)
                      return;
                  if (typeof nextVersion !== `object` || nextVersion === null)
                      throw new Error(`Assertion failed: The nextVersion field should have been an object`);
                  const newVersion = workspace.manifest.raw.nextVersion.semver;
                  if (typeof newVersion === `undefined`)
                      return;
                  if (typeof newVersion !== `string`)
                      throw new Error(`Assertion failed: The nextVersion.semver should have been a string`);
                  if (!semver_1.default.valid(newVersion)) {
                      throw new clipanion_1.UsageError(`Can't apply the version bump if the resulting version (${newVersion}) isn't valid semver`);
                  }
              };
              if (!this.all) {
                  validateWorkspace(workspace);
              }
              else {
                  for (const workspace of project.workspaces) {
                      validateWorkspace(workspace);
                  }
              }
              // Now that we know which workspaces depend on which others, we can
              // proceed to update everything at once using our accumulated knowledge.
              const processWorkspace = (workspace) => {
                  const nextVersion = workspace.manifest.raw.nextVersion;
                  if (typeof nextVersion === `undefined`)
                      return;
                  if (typeof nextVersion !== `object` || nextVersion === null)
                      throw new Error(`Assertion failed: The nextVersion field should have been an object`);
                  const newVersion = workspace.manifest.raw.nextVersion.semver;
                  if (typeof newVersion === `undefined`)
                      return;
                  if (typeof newVersion !== `string`)
                      throw new Error(`Assertion failed: The nextVersion.semver should have been a string`);
                  const oldVersion = workspace.manifest.version;
                  workspace.manifest.version = newVersion;
                  workspace.manifest.raw.nextVersion = undefined;
                  const identString = workspace.manifest.name !== null
                      ? core_3.structUtils.stringifyIdent(workspace.manifest.name)
                      : null;
                  report.reportInfo(core_2.MessageName.UNNAMED, `${core_3.structUtils.prettyLocator(configuration, workspace.anchoredLocator)}: Bumped to ${newVersion}`);
                  report.reportJson({ cwd: workspace.cwd, ident: identString, oldVersion, newVersion });
                  const dependents = allDependents.get(workspace);
                  if (typeof dependents === `undefined`)
                      return;
                  for (const [dependent, set, identHash] of dependents) {
                      const descriptor = dependent.manifest[set].get(identHash);
                      if (typeof descriptor === `undefined`)
                          throw new Error(`Assertion failed: The dependency should have existed`);
                      let range = descriptor.range;
                      let useWorkspaceProtocol = false;
                      if (range.startsWith(core_2.WorkspaceResolver.protocol)) {
                          range = range.slice(core_2.WorkspaceResolver.protocol.length);
                          useWorkspaceProtocol = true;
                          // Workspaces referenced through their path never get upgraded ("workspace:packages/yarnpkg-core")
                          if (range === workspace.relativeCwd) {
                              continue;
                          }
                      }
                      // We can only auto-upgrade the basic semver ranges (we can't auto-upgrade ">=1.0.0 <2.0.0", for example)
                      const parsed = range.match(SUPPORTED_UPGRADE_REGEXP);
                      if (!parsed) {
                          report.reportWarning(core_2.MessageName.UNNAMED, `Couldn't auto-upgrade range ${range} (in ${core_3.structUtils.prettyLocator(configuration, workspace.anchoredLocator)})`);
                          continue;
                      }
                      let newRange = `${parsed[1]}${newVersion}`;
                      if (useWorkspaceProtocol)
                          newRange = `${core_2.WorkspaceResolver.protocol}${newRange}`;
                      const newDescriptor = core_3.structUtils.makeDescriptor(descriptor, newRange);
                      dependent.manifest[set].set(identHash, newDescriptor);
                  }
              };
              if (!this.all) {
                  processWorkspace(workspace);
              }
              else {
                  for (const workspace of project.workspaces) {
                      processWorkspace(workspace);
                  }
              }
              await project.persist();
          });
          return applyReport.exitCode();
      }
  }
  VersionApplyCommand.usage = clipanion_1.Command.Usage({
      category: `Release-related commands`,
      description: `apply all the deferred version bumps at once`,
      details: `
        This command will apply the deferred version changes (scheduled via \`yarn version major|minor|patch\`) on the current workspace (or all of them if \`--all\`) is specified.

        It will also update the \`workspace:\` references across all your local workspaces so that they keep refering to the same workspace even after the version bump.

        If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
      `,
      examples: [[
              `Apply the version change to the local workspace`,
              `yarn version apply`,
          ], [
              `Apply the version change to all the workspaces in the local workspace`,
              `yarn version apply --all`,
          ]],
  });
  __decorate([
      clipanion_1.Command.Boolean(`--all`)
  ], VersionApplyCommand.prototype, "all", void 0);
  __decorate([
      clipanion_1.Command.Boolean(`--json`)
  ], VersionApplyCommand.prototype, "json", void 0);
  __decorate([
      clipanion_1.Command.Boolean(`--dependents`)
  ], VersionApplyCommand.prototype, "dependents", void 0);
  __decorate([
      clipanion_1.Command.Path(`version`, `apply`)
  ], VersionApplyCommand.prototype, "execute", null);
  exports.default = VersionApplyCommand;


  /***/ }),
  /* 3 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/cli");

  /***/ }),
  /* 4 */
  /***/ (function(module, exports) {

  module.exports = require("clipanion");

  /***/ }),
  /* 5 */
  /***/ (function(module, exports) {

  module.exports = require("semver");

  /***/ }),
  /* 6 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";

  var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  const cli_1 = __webpack_require__(3);
  const core_1 = __webpack_require__(1);
  const fslib_1 = __webpack_require__(7);
  const clipanion_1 = __webpack_require__(4);
  // eslint-disable-next-line arca/no-default-export
  class VersionApplyCommand extends clipanion_1.Command {
      async execute() {
          const configuration = await core_1.Configuration.find(this.context.cwd, this.context.plugins);
          const { project, workspace } = await core_1.Project.find(configuration, this.context.cwd);
          if (!workspace)
              throw new cli_1.WorkspaceRequiredError(this.context.cwd);
          const report = await core_1.StreamReport.start({
              configuration,
              stdout: this.context.stdout,
          }, async (report) => {
              const root = await fetchRoot(this.context.cwd);
              const base = await fetchBase(root);
              const files = await fetchChangedFiles(root, { base: base.hash });
              const workspaces = new Set(files.map(file => project.getWorkspaceByFilePath(file)));
              const releases = new Set();
              let hasDiffErrors = false;
              let hasDepsErrors = false;
              report.reportInfo(core_1.MessageName.UNNAMED, `Your PR was started right after ${configuration.format(base.hash.slice(0, 7), `yellow`)} ${configuration.format(base.message, `magenta`)}`);
              if (files.length > 0) {
                  report.reportInfo(core_1.MessageName.UNNAMED, `you have changed the following files since then:`);
                  for (const file of files) {
                      report.reportInfo(null, file);
                  }
              }
              // First we check which workspaces have received modifications but no release strategies
              for (const workspace of workspaces) {
                  // Let's assume that packages without versions don't need to see their version increased
                  if (workspace.manifest.version === null)
                      continue;
                  const currentNonce = getNonce(workspace.manifest);
                  const previousNonce = await fetchPreviousNonce(workspace, { root, base: base.hash });
                  // If the nonce is the same, it means that the user didn't run one of the `yarn version <>` variants since they started working on this diff
                  if (currentNonce === previousNonce) {
                      if (!hasDiffErrors && files.length > 0)
                          report.reportSeparator();
                      report.reportError(core_1.MessageName.UNNAMED, `${core_1.structUtils.prettyLocator(configuration, workspace.anchoredLocator)} has been modified but doesn't have a bump strategy attached`);
                      hasDiffErrors = true;
                  }
                  else {
                      // If it changed and a bump is planned, we mark it so that we can check that its dependents also chose whether they want to be bumped or not
                      if (willBeReleased(workspace.manifest)) {
                          releases.add(workspace.anchoredLocator.locatorHash);
                      }
                  }
              }
              // Then we check which workspaces depend on packages that will be released again but have no release strategies themselves
              for (const workspace of project.workspaces) {
                  // We don't need to check whether the dependencies of packages that will be bumped because of this PR changed
                  if (releases.has(workspace.anchoredLocator.locatorHash))
                      continue;
                  // We also don't need to check whether the dependencies of private packages changed, as they are supposed to only make sense within the context of the monorepo
                  if (workspace.manifest.private)
                      continue;
                  // Let's assume that packages without versions don't need to see their version increased
                  if (workspace.manifest.version === null)
                      continue;
                  for (const descriptor of workspace.dependencies.values()) {
                      const resolution = project.storedResolutions.get(descriptor.descriptorHash);
                      if (typeof resolution === `undefined`)
                          throw new Error(`Assertion failed: The resolution should have been registered`);
                      const pkg = project.storedPackages.get(resolution);
                      if (typeof pkg === `undefined`)
                          throw new Error(`Assertion failed: The package should have been registered`);
                      // We only care about workspaces, and we only care about workspaces that will be bumped
                      if (!releases.has(resolution))
                          continue;
                      // Quick note: we don't want to check whether the workspace pointer
                      // by `resolution` is private, because while it doesn't makes sense
                      // to bump a private package because its dependencies changed, the
                      // opposite isn't true: a (public) package might need to be bumped
                      // because one of its dev dependencies is a (private) package whose
                      // behavior sensibly changed.
                      if (!hasDepsErrors && (files.length > 0 || hasDiffErrors))
                          report.reportSeparator();
                      report.reportError(core_1.MessageName.UNNAMED, `${core_1.structUtils.prettyLocator(configuration, workspace.anchoredLocator)} doesn't have a bump strategy attached, but depends on ${core_1.structUtils.prettyLocator(configuration, pkg)} which will be re-released.`);
                      hasDepsErrors = true;
                  }
              }
              if (hasDiffErrors || hasDepsErrors) {
                  report.reportSeparator();
                  report.reportInfo(core_1.MessageName.UNNAMED, `This command detected that at least some workspaces have received modifications but no explicit instructions as to how they had to be released (if needed).`);
                  report.reportInfo(core_1.MessageName.UNNAMED, `To correct these errors, run \`yarn version ... --deferred\` in each of them with the adequate bump strategies, then run \`yarn version check\` again.`);
              }
          });
          return report.exitCode();
      }
  }
  VersionApplyCommand.usage = clipanion_1.Command.Usage({
      category: `Release-related commands`,
      description: `check that all the relevant packages have been bumped`,
      details: `
        **Warning:** This command currently requires Git.

        This command will check that all the packages covered by the files listed in argument have been properly bumped or declined to bump.

        In the case of a bump, the check will also cover transitive packages - meaning that should \`Foo\` be bumped, a package \`Bar\` depending on \`Foo\` will require a decision as to whether \`Bar\` will need to be bumped. This check doesn't cross packages that have declined to bump.

        In case no arguments are passed to the function, the list of modified files will be generated by comparing the HEAD against \`master\`.
      `,
      examples: [[
              `Check whether the modified packages need a bump`,
              `yarn version check`,
          ]],
  });
  __decorate([
      clipanion_1.Command.Path(`version`, `check`)
  ], VersionApplyCommand.prototype, "execute", null);
  exports.default = VersionApplyCommand;
  async function fetchBase(root) {
      const candidateBases = [`master`, `origin/master`, `upstream/master`];
      const ancestorBases = [];
      for (const candidate of candidateBases) {
          const { code } = await core_1.execUtils.execvp(`git`, [`merge-base`, candidate, `HEAD`], { cwd: root });
          if (code === 0) {
              ancestorBases.push(candidate);
          }
      }
      if (ancestorBases.length === 0)
          throw new clipanion_1.UsageError(`No ancestor could be found between any of HEAD and ${candidateBases.join(`, `)}`);
      const { stdout: mergeBaseStdout } = await core_1.execUtils.execvp(`git`, [`merge-base`, `HEAD`, ...ancestorBases], { cwd: root, strict: true });
      const hash = mergeBaseStdout.trim();
      const { stdout: showStdout } = await core_1.execUtils.execvp(`git`, [`show`, `--quiet`, `--pretty=format:%s`, hash], { cwd: root, strict: true });
      const message = showStdout.trim();
      return { hash, message };
  }
  async function fetchRoot(initialCwd) {
      // Note: We can't just use `git rev-parse --show-toplevel`, because on Windows
      // it may return long paths even when the cwd uses short paths, and we have no
      // way to detect it from Node (not even realpath).
      let match = null;
      let cwd;
      let nextCwd = initialCwd;
      do {
          cwd = nextCwd;
          if (await fslib_1.xfs.existsPromise(fslib_1.ppath.join(cwd, `.git`)))
              match = cwd;
          nextCwd = fslib_1.ppath.dirname(cwd);
      } while (match === null && nextCwd !== cwd);
      if (match === null)
          throw new clipanion_1.UsageError(`This command can only be run from within a Git repository`);
      return match;
  }
  async function fetchChangedFiles(root, { base }) {
      const { stdout: diffStdout } = await core_1.execUtils.execvp(`git`, [`diff`, `--name-only`, base], { cwd: root, strict: true });
      const files = diffStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => fslib_1.ppath.resolve(root, fslib_1.toPortablePath(file)));
      const { stdout: untrackedStdout } = await core_1.execUtils.execvp(`git`, [`ls-files`, `--others`, `--exclude-standard`], { cwd: root, strict: true });
      const moreFiles = untrackedStdout.split(/\r\n|\r|\n/).filter(file => file.length > 0).map(file => fslib_1.ppath.resolve(root, fslib_1.toPortablePath(file)));
      return [...files, ...moreFiles];
  }
  async function fetchPreviousNonce(workspace, { root, base }) {
      const { code, stdout } = await core_1.execUtils.execvp(`git`, [`show`, `${base}:${fslib_1.fromPortablePath(fslib_1.ppath.relative(root, fslib_1.ppath.join(workspace.cwd, `package.json`)))}`], { cwd: workspace.cwd });
      if (code === 0) {
          return getNonce(core_1.Manifest.fromText(stdout));
      }
      else {
          return null;
      }
  }
  function getNonce(manifest) {
      if (manifest.raw.nextVersion && (typeof manifest.raw.nextVersion.nonce === `string` || typeof manifest.raw.nextVersion.nonce === `number`)) {
          return String(manifest.raw.nextVersion.nonce);
      }
      else {
          return null;
      }
  }
  function willBeReleased(manifest) {
      if (manifest.raw.nextVersion && typeof manifest.raw.nextVersion.semver === `string` && manifest.raw.nextVersion !== manifest.raw.version) {
          return true;
      }
      else {
          return false;
      }
  }


  /***/ }),
  /* 7 */
  /***/ (function(module, exports) {

  module.exports = require("@yarnpkg/fslib");

  /***/ }),
  /* 8 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";

  var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var __importDefault = (this && this.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
  };
  var __importStar = (this && this.__importStar) || function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
      result["default"] = mod;
      return result;
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  const cli_1 = __webpack_require__(3);
  const core_1 = __webpack_require__(1);
  const clipanion_1 = __webpack_require__(4);
  const semver_1 = __importDefault(__webpack_require__(5));
  const yup = __importStar(__webpack_require__(9));
  // This is a special strategy; Yarn won't change the semver version,
  // but will change the nonce. This will cause `yarn version check` to
  // stop reporting the package as having no explicit bump strategy.
  const DECLINE = `decline`;
  const STRATEGIES = new Set([
      `major`,
      `minor`,
      `patch`,
      `premajor`,
      `preminor`,
      `prepatch`,
      `prerelease`,
      DECLINE,
  ]);
  // eslint-disable-next-line arca/no-default-export
  class VersionCommand extends cli_1.BaseCommand {
      constructor() {
          super(...arguments);
          this.force = false;
      }
      async execute() {
          const configuration = await core_1.Configuration.find(this.context.cwd, this.context.plugins);
          const { workspace } = await core_1.Project.find(configuration, this.context.cwd);
          if (!workspace)
              throw new cli_1.WorkspaceRequiredError(this.context.cwd);
          let deferred = configuration.get(`preferDeferredVersions`);
          if (this.deferred)
              deferred = true;
          if (this.immediate)
              deferred = false;
          const isSemver = semver_1.default.valid(this.strategy);
          const isDeclined = this.strategy === DECLINE;
          let nextVersion;
          if (isSemver) {
              nextVersion = this.strategy;
          }
          else {
              let currentVersion = workspace.manifest.version;
              if (!isDeclined) {
                  if (currentVersion === null)
                      throw new clipanion_1.UsageError(`Can't bump the version if there wasn't a version to begin with - use 0.0.0 as initial version then run the command again.`);
                  if (typeof currentVersion !== `string` || !semver_1.default.valid(currentVersion)) {
                      throw new clipanion_1.UsageError(`Can't bump the version (${currentVersion}) if it's not valid semver`);
                  }
              }
              const bumpedVersion = !isDeclined
                  ? semver_1.default.inc(currentVersion, this.strategy)
                  : currentVersion;
              if (!isDeclined && bumpedVersion === null)
                  throw new Error(`Assertion failed: Failed to increment the version number (${currentVersion})`);
              nextVersion = bumpedVersion;
          }
          if (workspace.manifest.raw.nextVersion) {
              const deferredVersion = workspace.manifest.raw.nextVersion.semver;
              if (typeof deferredVersion !== `undefined`) {
                  if (!isDeclined) {
                      if (semver_1.default.gt(deferredVersion, nextVersion) && !this.force) {
                          throw new clipanion_1.UsageError(`The target version (${nextVersion}) is smaller than the one currently registered (${deferredVersion}); use -f,--force to overwrite.`);
                      }
                  }
                  else {
                      nextVersion = deferredVersion;
                  }
              }
          }
          workspace.manifest.setRawField(`nextVersion`, {
              semver: nextVersion !== workspace.manifest.version ? nextVersion : undefined,
              nonce: String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
          }, { after: [`version`] });
          await workspace.persistManifest();
          if (!deferred) {
              await this.cli.run([`version`, `apply`]);
          }
      }
  }
  VersionCommand.schema = yup.object().shape({
      strategy: yup.string().test({
          name: `strategy`,
          message: '${path} must be a semver range or one of ${strategies}',
          params: { strategies: Array.from(STRATEGIES).join(`, `) },
          test: (range) => {
              return semver_1.default.valid(range) !== null || STRATEGIES.has(range);
          },
      }),
  });
  VersionCommand.usage = clipanion_1.Command.Usage({
      category: `Release-related commands`,
      description: `apply a new version to the current package`,
      details: `
        This command will bump the version number for the given package, following the specified strategy:

        - If \`major\`, the first number from the semver range will be increased (\`X.0.0\`).
        - If \`minor\`, the second number from the semver range will be increased (\`0.X.0\`).
        - If \`patch\`, the third number from the semver range will be increased (\`0.0.X\`).
        - If prefixed by \`pre\` (\`premajor\`, ...), a \`-0\` suffix will be set (\`0.0.0-0\`).
        - If \`prerelease\`, the suffix will be increased (\`0.0.0-X\`); the third number from the semver range will also be increased if there was no suffix in the previous version.
        - If \`decline\`, the nonce will be increased for \`yarn version check\` to pass without version bump.
        - If a valid semver range, it will be used as new version.
        - If unspecified, Yarn will ask you for guidance.

        For more information about the \`--deferred\` flag, consult our documentation ("Managing Releases").
      `,
      examples: [[
              `Immediatly bump the version to the next major`,
              `yarn version major`,
          ], [
              `Prepare the version to be bumped to the next major`,
              `yarn version major --deferred`,
          ]],
  });
  __decorate([
      clipanion_1.Command.String()
  ], VersionCommand.prototype, "strategy", void 0);
  __decorate([
      clipanion_1.Command.Boolean(`-d,--deferred`)
  ], VersionCommand.prototype, "deferred", void 0);
  __decorate([
      clipanion_1.Command.Boolean(`-i,--immediate`)
  ], VersionCommand.prototype, "immediate", void 0);
  __decorate([
      clipanion_1.Command.Boolean(`-f,--force`)
  ], VersionCommand.prototype, "force", void 0);
  __decorate([
      clipanion_1.Command.Path(`version`)
  ], VersionCommand.prototype, "execute", null);
  exports.default = VersionCommand;


  /***/ }),
  /* 9 */
  /***/ (function(module, exports) {

  module.exports = require("yup");

  /***/ })
  /******/ ]);
  return plugin;
};

module.exports.name = "@yarnpkg/plugin-version";
