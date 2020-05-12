import {BaseCommand, WorkspaceRequiredError}                                   from '@yarnpkg/cli';
import {Configuration, Cache, MessageName, Project, ReportError, StreamReport} from '@yarnpkg/core';
import {xfs, ppath}                                                            from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                              from '@yarnpkg/parsers';
import {Command, Usage}                                                        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class YarnCommand extends BaseCommand {
  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.Boolean(`--immutable`)
  immutable?: boolean;

  @Command.Boolean(`--immutable-cache`)
  immutableCache?: boolean;

  @Command.Boolean(`--check-cache`)
  checkCache: boolean = false;

  @Command.Boolean(`--frozen-lockfile`, {hidden: true})
  frozenLockfile?: boolean;

  @Command.Boolean(`--prefer-offline`, {hidden: true})
  preferOffline?: boolean;

  @Command.Boolean(`--ignore-engines`, {hidden: true})
  ignoreEngines?: boolean;

  @Command.String(`--registry`, {hidden: true})
  registry?: string;

  @Command.Boolean(`--inline-builds`)
  inlineBuilds?: boolean;

  @Command.String(`--cache-folder`)
  cacheFolder?: string;

  @Command.Boolean(`--silent`, {hidden: true})
  silent?: boolean = false;

  static usage: Usage = Command.Usage({
    description: `install the project dependencies`,
    details: `
      This command setup your project if needed. The installation is splitted in four different steps that each have their own characteristics:

      - **Resolution:** First the package manager will resolve your dependencies. The exact way a dependency version is privileged over another isn't standardized outside of the regular semver guarantees. If a package doesn't resolve to what you would expect, check that all dependencies are correctly declared (also check our website for more information: ).

      - **Fetch:** Then we download all the dependencies if needed, and make sure that they're all stored within our cache (check the value of \`cacheFolder\` in \`yarn config\` to see where are stored the cache files).

      - **Link:** Then we send the dependency tree information to internal plugins tasked from writing them on the disk in some form (for example by generating the .pnp.js file you might know).

      - **Build:** Once the dependency tree has been written on the disk, the package manager will now be free to run the build scripts for all packages that might need it, in a topological order compatible with the way they depend on one another.

      Note that running this command is not part of the recommended workflow. Yarn supports zero-installs, which means that as long as you store your cache and your .pnp.js file inside your repository, everything will work without requiring any install right after cloning your repository or switching branches.

      If the \`--immutable\` option is set, Yarn will abort with an error exit code if anything in the install artifacts (\`yarn.lock\`, \`.pnp.js\`, ...) was to be modified. For backward compatibility we offer an alias under the name of \`--frozen-lockfile\`, but it will be removed in a later release.

      If the \`--immutable-cache\` option is set, Yarn will abort with an error exit code if the cache folder was to be modified (either because files would be added, or because they'd be removed).

      If the \`--check-cache\` option is set, Yarn will always refetch the packages and will ensure that their checksum matches what's 1/ described in the lockfile 2/ inside the existing cache files (if present). This is recommended as part of your CI workflow if you're both following the Zero-Installs model and accepting PRs from third-parties, as they'd otherwise have the ability to alter the checked-in packages before submitting them.

      If the \`--inline-builds\` option is set, Yarn will verbosely print the output of the build steps of your dependencies (instead of writing them into individual files). This is likely useful mostly for debug purposes only when using Docker-like environments.

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `Install the project`,
      `$0 install`,
    ], [
      `Validate a project when using Zero-Installs`,
      `$0 install --immutable --immutable-cache`,
    ], [
      `Validate a project when using Zero-Installs (slightly safer if you accept external PRs)`,
      `$0 install --immutable --immutable-cache --check-cache`,
    ]],
  });

  @Command.Path()
  @Command.Path(`install`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    if (typeof this.inlineBuilds !== `undefined`)
      configuration.useWithSource(`<cli>`, {enableInlineBuilds: this.inlineBuilds}, configuration.startingCwd, {overwrite: true});

    const isZeitNow = !!process.env.NOW_BUILDER;
    const isNetlify = !!process.env.NETLIFY;

    const reportDeprecation = async (message: string, {error}: {error: boolean}) => {
      const deprecationReport = await StreamReport.start({
        configuration,
        stdout: this.context.stdout,
        includeFooter: false,
      }, async report => {
        if (error) {
          report.reportError(MessageName.DEPRECATED_CLI_SETTINGS, message);
        } else {
          report.reportWarning(MessageName.DEPRECATED_CLI_SETTINGS, message);
        }
      });

      if (deprecationReport.hasErrors()) {
        return deprecationReport.exitCode();
      } else {
        return null;
      }
    };

    // The ignoreEngines flag isn't implemented at the moment. I'm still
    // considering how it should work in the context of plugins - would it
    // make sense to allow them (or direct dependencies) to define new
    // "engine check"? Since it has implications regarding the architecture,
    // I prefer to postpone the decision to later. Also it wouldn't be a flag,
    // it would definitely be a configuration setting.
    if (typeof this.ignoreEngines !== `undefined`) {
      const exitCode = await reportDeprecation(`The --ignore-engines option is deprecated; engine checking isn't a core feature anymore`, {
        error: !isZeitNow,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // The registry flag isn't supported anymore because it makes little sense
    // to use a registry for a single install. You instead want to configure it
    // for all installs inside a project, so through the .yarnrc.yml file. Note
    // that if absolutely necessary, the old behavior can be emulated by adding
    // the YARN_NPM_REGISTRY_SERVER variable to the environment.
    if (typeof this.registry !== `undefined`) {
      const exitCode = await reportDeprecation(`The --registry option is deprecated; prefer setting npmRegistryServer in your .yarnrc.yml file`, {
        error: false,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // The preferOffline flag doesn't make much sense with our architecture.
    // It would require the fetchers to also act as resolvers, which is
    // doable but quirky. Since a similar behavior is available via the
    // --cached flag in yarn add, I prefer to move it outside of the core and
    // let someone implement this "resolver-that-reads-the-cache" logic.
    if (typeof this.preferOffline !== `undefined`) {
      const exitCode = await reportDeprecation(`The --prefer-offline flag is deprecated; use the --cached flag with 'yarn add' instead`, {
        error: !isZeitNow,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // We want to prevent people from using --frozen-lockfile
    // Note: it's been deprecated because we're now locking more than just the
    // lockfile - for example the PnP artifacts will also be locked.
    if (typeof this.frozenLockfile !== `undefined`) {
      const exitCode = await reportDeprecation(`The --frozen-lockfile option is deprecated; use --immutable and/or --immutable-cache instead`, {
        error: true,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // We also want to prevent them from using --cache-folder
    // Note: it's been deprecated because the cache folder should be set from
    // the settings. Otherwise there would be a very high chance that multiple
    // Yarn commands would use different caches, causing unexpected behaviors.
    if (typeof this.cacheFolder !== `undefined`) {
      const exitCode = await reportDeprecation(`The cache-folder option has been deprecated; use rc settings instead`, {
        error: !isNetlify,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    const immutable = typeof this.immutable === `undefined` && typeof this.frozenLockfile === `undefined`
      ? configuration.get(`enableImmutableInstalls`)
      : this.immutable || this.frozenLockfile;

    if (configuration.projectCwd !== null) {
      const fixReport = await StreamReport.start({
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        includeFooter: false,
      }, async report => {
        if (await autofixMergeConflicts(configuration, immutable)) {
          report.reportInfo(MessageName.AUTOMERGE_SUCCESS, `Automatically fixed merge conflicts 👍`);
        }
      });

      if (fixReport.hasErrors()) {
        return fixReport.exitCode();
      }
    }

    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration, {immutable: this.immutableCache, check: this.checkCache});

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    // Important: Because other commands also need to run installs, if you
    // get in a situation where you need to change this file in order to
    // customize the install it's very likely you're doing something wrong.
    // This file should stay super super simple, and the configuration and
    // install logic should be implemented elsewhere (probably in either of
    // the Configuration and Install classes). Feel free to open an issue
    // in order to ask for design feedback before writing features.

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      includeLogs: true,
    }, async (report: StreamReport) => {
      await project.install({cache, report, immutable});
    });

    return report.exitCode();
  }
}

const MERGE_CONFLICT_ANCESTOR = `|||||||`;
const MERGE_CONFLICT_END = `>>>>>>>`;
const MERGE_CONFLICT_SEP = `=======`;
const MERGE_CONFLICT_START = `<<<<<<<`;

async function autofixMergeConflicts(configuration: Configuration, immutable: boolean) {
  if (!configuration.projectCwd)
    return false;

  const lockfilePath = ppath.join(configuration.projectCwd, configuration.get(`lockfileFilename`));
  if (!await xfs.existsPromise(lockfilePath))
    return false;

  const file = await xfs.readFilePromise(lockfilePath, `utf8`);
  if (!file.includes(MERGE_CONFLICT_START))
    return false;

  if (immutable)
    throw new ReportError(MessageName.AUTOMERGE_IMMUTABLE, `Cannot autofix a lockfile when running an immutable install`);

  const [left, right] = getVariants(file);

  let parsedLeft;
  let parsedRight;
  try {
    parsedLeft = parseSyml(left);
    parsedRight = parseSyml(right);
  } catch (error) {
    throw new ReportError(MessageName.AUTOMERGE_FAILED_TO_PARSE, `The individual variants of the lockfile failed to parse`);
  }

  const merged = {
    ...parsedLeft,
    ...parsedRight,
  };

  // Old-style lockfiles should be filtered out (for example when switching
  // from a Yarn 2 branch to a Yarn 1 branch). Fortunately (?), they actually
  // parse as valid YAML except that the objects become strings. We can use
  // that to detect them. Damn, it's really ugly though.
  for (const [key, value] of Object.entries(merged))
    if (typeof value === `string`)
      delete merged[key];

  await xfs.changeFilePromise(lockfilePath, stringifySyml(merged), {
    automaticNewlines: true,
  });

  return true;
}

function getVariants(file: string) {
  const variants: [Array<string>, Array<string>] = [[], []];
  const lines = file.split(/\r?\n/g);

  let skip = false;

  while (lines.length > 0) {
    const line = lines.shift();
    if (typeof line === `undefined`)
      throw new Error(`Assertion failed: Some lines should remain`);

    if (line.startsWith(MERGE_CONFLICT_START)) {
      // get the first variant
      while (lines.length > 0) {
        const conflictLine = lines.shift();
        if (typeof conflictLine === `undefined`)
          throw new Error(`Assertion failed: Some lines should remain`);

        if (conflictLine === MERGE_CONFLICT_SEP) {
          skip = false;
          break;
        } else if (skip || conflictLine.startsWith(MERGE_CONFLICT_ANCESTOR)) {
          skip = true;
          continue;
        } else {
          variants[0].push(conflictLine);
        }
      }

      // get the second variant
      while (lines.length > 0) {
        const conflictLine = lines.shift();
        if (typeof conflictLine === `undefined`)
          throw new Error(`Assertion failed: Some lines should remain`);

        if (conflictLine.startsWith(MERGE_CONFLICT_END)) {
          break;
        } else {
          variants[1].push(conflictLine);
        }
      }
    } else {
      variants[0].push(line);
      variants[1].push(line);
    }
  }

  return [
    variants[0].join(`\n`),
    variants[1].join(`\n`),
  ];
}
