import {BaseCommand, WorkspaceRequiredError}                                                                                                                                                    from '@yarnpkg/cli';
import {Configuration, Cache, MessageName, Project, ReportError, StreamReport, formatUtils, InstallMode, execUtils, structUtils, LEGACY_PLUGINS, ConfigurationValueMap, YarnVersion, httpUtils} from '@yarnpkg/core';
import {xfs, ppath, Filename, PortablePath}                                                                                                                                                     from '@yarnpkg/fslib';
import {parseSyml, stringifySyml}                                                                                                                                                               from '@yarnpkg/parsers';
import CI                                                                                                                                                                                       from 'ci-info';
import {Command, Option, Usage, UsageError}                                                                                                                                                     from 'clipanion';
import semver                                                                                                                                                                                   from 'semver';
import * as t                                                                                                                                                                                   from 'typanion';

const LOCKFILE_MIGRATION_RULES: Array<{
  selector: (version: number) => boolean;
  name: keyof ConfigurationValueMap;
  value: any;
}> = [{
  selector: v => v === -1,
  name: `nodeLinker`,
  value: `node-modules`,
}, {
  selector: v => v !== -1 && v < 8,
  name: `enableGlobalCache`,
  value: false,
}, {
  selector: v => v !== -1 && v < 8,
  name: `compressionLevel`,
  value: `mixed`,
}];

// eslint-disable-next-line arca/no-default-export
export default class YarnCommand extends BaseCommand {
  static paths = [
    [`install`],
    Command.Default,
  ];

  static usage: Usage = Command.Usage({
    description: `install the project dependencies`,
    details: `
      This command sets up your project if needed. The installation is split into four different steps that each have their own characteristics:

      - **Resolution:** First the package manager will resolve your dependencies. The exact way a dependency version is privileged over another isn't standardized outside of the regular semver guarantees. If a package doesn't resolve to what you would expect, check that all dependencies are correctly declared (also check our website for more information: ).

      - **Fetch:** Then we download all the dependencies if needed, and make sure that they're all stored within our cache (check the value of \`cacheFolder\` in \`yarn config\` to see where the cache files are stored).

      - **Link:** Then we send the dependency tree information to internal plugins tasked with writing them on the disk in some form (for example by generating the .pnp.cjs file you might know).

      - **Build:** Once the dependency tree has been written on the disk, the package manager will now be free to run the build scripts for all packages that might need it, in a topological order compatible with the way they depend on one another. See https://yarnpkg.com/advanced/lifecycle-scripts for detail.

      Note that running this command is not part of the recommended workflow. Yarn supports zero-installs, which means that as long as you store your cache and your .pnp.cjs file inside your repository, everything will work without requiring any install right after cloning your repository or switching branches.

      If the \`--immutable\` option is set (defaults to true on CI), Yarn will abort with an error exit code if the lockfile was to be modified (other paths can be added using the \`immutablePatterns\` configuration setting). For backward compatibility we offer an alias under the name of \`--frozen-lockfile\`, but it will be removed in a later release.

      If the \`--immutable-cache\` option is set, Yarn will abort with an error exit code if the cache folder was to be modified (either because files would be added, or because they'd be removed).

      If the \`--refresh-lockfile\` option is set, Yarn will keep the same resolution for the packages currently in the lockfile but will refresh their metadata. If used together with \`--immutable\`, it can validate that the lockfile information are consistent. This flag is enabled by default when Yarn detects it runs within a pull request context.

      If the \`--check-cache\` option is set, Yarn will always refetch the packages and will ensure that their checksum matches what's 1/ described in the lockfile 2/ inside the existing cache files (if present). This is recommended as part of your CI workflow if you're both following the Zero-Installs model and accepting PRs from third-parties, as they'd otherwise have the ability to alter the checked-in packages before submitting them.

      If the \`--inline-builds\` option is set, Yarn will verbosely print the output of the build steps of your dependencies (instead of writing them into individual files). This is likely useful mostly for debug purposes only when using Docker-like environments.

      If the \`--mode=<mode>\` option is set, Yarn will change which artifacts are generated. The modes currently supported are:

      - \`skip-build\` will not run the build scripts at all. Note that this is different from setting \`enableScripts\` to false because the latter will disable build scripts, and thus affect the content of the artifacts generated on disk, whereas the former will just disable the build step - but not the scripts themselves, which just won't run.

      - \`update-lockfile\` will skip the link step altogether, and only fetch packages that are missing from the lockfile (or that have no associated checksums). This mode is typically used by tools like Renovate or Dependabot to keep a lockfile up-to-date without incurring the full install cost.
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

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  immutable = Option.Boolean(`--immutable`, {
    description: `Abort with an error exit code if the lockfile was to be modified`,
  });

  immutableCache = Option.Boolean(`--immutable-cache`, {
    description: `Abort with an error exit code if the cache folder was to be modified`,
  });

  refreshLockfile = Option.Boolean(`--refresh-lockfile`, {
    description: `Refresh the package metadata stored in the lockfile`,
  });

  checkCache = Option.Boolean(`--check-cache`, {
    description: `Always refetch the packages and ensure that their checksums are consistent`,
  });

  checkResolutions = Option.Boolean(`--check-resolutions`, {
    description: `Validates that the package resolutions are coherent`,
  });

  inlineBuilds = Option.Boolean(`--inline-builds`, {
    description: `Verbosely print the output of the build steps of dependencies`,
  });

  mode = Option.String(`--mode`, {
    description: `Change what artifacts installs generate`,
    validator: t.isEnum(InstallMode),
  });

  // Legacy flags; will emit errors or warnings when used
  cacheFolder = Option.String(`--cache-folder`, {hidden: true});
  frozenLockfile = Option.Boolean(`--frozen-lockfile`, {hidden: true});
  ignoreEngines = Option.Boolean(`--ignore-engines`, {hidden: true});
  nonInteractive = Option.Boolean(`--non-interactive`, {hidden: true});
  preferOffline = Option.Boolean(`--prefer-offline`, {hidden: true});
  production = Option.Boolean(`--production`, {hidden: true});
  registry = Option.String(`--registry`, {hidden: true});
  silent = Option.Boolean(`--silent`, {hidden: true});
  networkTimeout = Option.String(`--network-timeout`, {hidden: true});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    if (typeof this.inlineBuilds !== `undefined`)
      configuration.useWithSource(`<cli>`, {enableInlineBuilds: this.inlineBuilds}, configuration.startingCwd, {overwrite: true});

    // These variables are used in Google Cloud Platform environment
    // in process of deploying Google Cloud Functions and
    // Google App Engine
    const isGCP = !!process.env.FUNCTION_TARGET || !!process.env.GOOGLE_RUNTIME;

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
        error: !CI.VERCEL,
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
        error: !CI.VERCEL,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // Since the production flag would yield a different lockfile than the
    // regular installs, it's not part of the regular `install` command anymore.
    // Instead, we expect users to use it with `yarn workspaces focus` (which can
    // be used even outside of monorepos).
    if (typeof this.production !== `undefined`) {
      const exitCode = await reportDeprecation(`The --production option is deprecated on 'install'; use 'yarn workspaces focus' instead`, {
        error: true,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // Yarn 2 isn't interactive during installs anyway, so there's no real point
    // to this flag at the moment.
    if (typeof this.nonInteractive !== `undefined`) {
      const exitCode = await reportDeprecation(`The --non-interactive option is deprecated`, {
        error: !isGCP,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    // We want to prevent people from using --frozen-lockfile
    // Note: it's been deprecated because we're now locking more than just the
    // lockfile - for example the PnP artifacts will also be locked.
    if (typeof this.frozenLockfile !== `undefined`) {
      await reportDeprecation(`The --frozen-lockfile option is deprecated; use --immutable and/or --immutable-cache instead`, {
        error: false,
      });

      this.immutable = this.frozenLockfile;
    }

    // We also want to prevent them from using --cache-folder
    // Note: it's been deprecated because the cache folder should be set from
    // the settings. Otherwise there would be a very high chance that multiple
    // Yarn commands would use different caches, causing unexpected behaviors.
    if (typeof this.cacheFolder !== `undefined`) {
      const exitCode = await reportDeprecation(`The cache-folder option has been deprecated; use rc settings instead`, {
        error: !CI.NETLIFY,
      });

      if (exitCode !== null) {
        return exitCode;
      }
    }

    const updateMode = this.mode === InstallMode.UpdateLockfile;
    if (updateMode && (this.immutable || this.immutableCache))
      throw new UsageError(`${formatUtils.pretty(configuration, `--immutable`, formatUtils.Type.CODE)} and ${formatUtils.pretty(configuration, `--immutable-cache`, formatUtils.Type.CODE)} cannot be used with ${formatUtils.pretty(configuration, `--mode=update-lockfile`, formatUtils.Type.CODE)}`);

    const immutable = (this.immutable ?? configuration.get(`enableImmutableInstalls`)) && !updateMode;
    const immutableCache = this.immutableCache && !updateMode;

    if (configuration.projectCwd !== null) {
      const fixReport = await StreamReport.start({
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        includeFooter: false,
      }, async report => {
        let changed = false;

        if (await autofixLegacyPlugins(configuration, immutable)) {
          report.reportInfo(MessageName.AUTOMERGE_SUCCESS, `Automatically removed core plugins that are now builtins 👍`);
          changed = true;
        }

        if (await autofixMergeConflicts(configuration, immutable)) {
          report.reportInfo(MessageName.AUTOMERGE_SUCCESS, `Automatically fixed merge conflicts 👍`);
          changed = true;
        }

        if (changed) {
          report.reportSeparator();
        }
      });

      if (fixReport.hasErrors()) {
        return fixReport.exitCode();
      }
    }

    if (configuration.projectCwd !== null) {
      const telemetryReport = await StreamReport.start({
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        includeFooter: false,
      }, async report => {
        if (Configuration.telemetry?.isNew) {
          Configuration.telemetry.commitTips();

          report.reportInfo(MessageName.TELEMETRY_NOTICE, `Yarn will periodically gather anonymous telemetry: https://yarnpkg.com/advanced/telemetry`);
          report.reportInfo(MessageName.TELEMETRY_NOTICE, `Run ${formatUtils.pretty(configuration, `yarn config set --home enableTelemetry 0`, formatUtils.Type.CODE)} to disable`);
          report.reportSeparator();
        } else if (Configuration.telemetry?.shouldShowTips) {
          const data = await httpUtils.get(`https://repo.yarnpkg.com/tags`, {configuration, jsonResponse: true}).catch(() => null) as {
            latest: {stable: string, canary: string};
            tips: Array<{message: string, url?: string}>;
          } | null;

          if (data !== null) {
            let newVersion: [string, string] | null = null;
            if (YarnVersion !== null) {
              const isRcBinary = semver.prerelease(YarnVersion);
              const releaseType = isRcBinary ? `canary` : `stable`;
              const candidate = data.latest[releaseType];

              if (semver.gt(candidate, YarnVersion)) {
                newVersion = [releaseType, candidate];
              }
            }

            if (newVersion) {
              Configuration.telemetry.commitTips();

              report.reportInfo(MessageName.VERSION_NOTICE, `${formatUtils.applyStyle(configuration, `A new ${newVersion[0]} version of Yarn is available:`, formatUtils.Style.BOLD)} ${structUtils.prettyReference(configuration, newVersion[1])}!`);
              report.reportInfo(MessageName.VERSION_NOTICE, `Upgrade now by running ${formatUtils.pretty(configuration, `yarn set version ${newVersion[1]}`, formatUtils.Type.CODE)}`);
              report.reportSeparator();
            } else {
              const tip = Configuration.telemetry.selectTip(data.tips);

              if (tip) {
                report.reportInfo(MessageName.TIPS_NOTICE, formatUtils.pretty(configuration, tip.message, formatUtils.Type.MARKDOWN_INLINE));

                if (tip.url)
                  report.reportInfo(MessageName.TIPS_NOTICE, `Learn more at ${tip.url}`);

                report.reportSeparator();
              }
            }
          }
        }
      });

      if (telemetryReport.hasErrors()) {
        return telemetryReport.exitCode();
      }
    }

    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    const lockfileLastVersion = project.lockfileLastVersion;
    if (lockfileLastVersion !== null) {
      const compatReport = await StreamReport.start({
        configuration,
        json: this.json,
        stdout: this.context.stdout,
        includeFooter: false,
      }, async report => {
        const newSettings: Record<string, any> = {};

        for (const rule of LOCKFILE_MIGRATION_RULES) {
          if (rule.selector(lockfileLastVersion) && typeof configuration.sources.get(rule.name) === `undefined`) {
            configuration.use(`<compat>`, {[rule.name]: rule.value}, project.cwd, {overwrite: true});
            newSettings[rule.name] = rule.value;
          }
        }

        if (Object.keys(newSettings).length > 0) {
          await Configuration.updateConfiguration(project.cwd, newSettings);

          report.reportInfo(MessageName.MIGRATION_SUCCESS, `Migrated your project to the latest Yarn version 🚀`);
          report.reportSeparator();
        }
      });

      if (compatReport.hasErrors()) {
        return compatReport.exitCode();
      }
    }

    const cache = await Cache.find(configuration, {immutable: immutableCache, check: this.checkCache});

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    const enableHardenedMode = configuration.get(`enableHardenedMode`);

    if (this.refreshLockfile ?? enableHardenedMode)
      project.lockfileNeedsRefresh = true;

    const checkResolutions = this.checkResolutions ?? enableHardenedMode;

    // Important: Because other commands also need to run installs, if you
    // get in a situation where you need to change this file in order to
    // customize the install it's very likely you're doing something wrong.
    // This file should stay super super simple, and the configuration and
    // install logic should be implemented elsewhere (probably in either of
    // the Configuration and Install classes). Feel free to open an issue
    // in order to ask for design feedback before writing features.

    return await project.installWithNewReport({
      json: this.json,
      stdout: this.context.stdout,
    }, {
      cache,
      immutable,
      checkResolutions,
      mode: this.mode,
    });
  }
}

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

  let commits = await execUtils.execvp(`git`, [`rev-parse`, `MERGE_HEAD`, `HEAD`], {
    cwd: configuration.projectCwd,
  });

  if (commits.code !== 0) {
    commits = await execUtils.execvp(`git`, [`rev-parse`, `REBASE_HEAD`, `HEAD`], {
      cwd: configuration.projectCwd,
    });
  }

  if (commits.code !== 0) {
    commits = await execUtils.execvp(`git`, [`rev-parse`, `CHERRY_PICK_HEAD`, `HEAD`], {
      cwd: configuration.projectCwd,
    });
  }

  if (commits.code !== 0)
    throw new ReportError(MessageName.AUTOMERGE_GIT_ERROR, `Git returned an error when trying to find the commits pertaining to the conflict`);

  let variants = await Promise.all(commits.stdout.trim().split(/\n/).map(async hash => {
    const content = await execUtils.execvp(`git`, [`show`, `${hash}:./${Filename.lockfile}`], {
      cwd: configuration.projectCwd!,
    });

    if (content.code !== 0)
      throw new ReportError(MessageName.AUTOMERGE_GIT_ERROR, `Git returned an error when trying to access the lockfile content in ${hash}`);

    try {
      return parseSyml(content.stdout);
    } catch {
      throw new ReportError(MessageName.AUTOMERGE_FAILED_TO_PARSE, `A variant of the conflicting lockfile failed to parse`);
    }
  }));

  // Old-style lockfiles should be filtered out (for example when switching
  // from a Yarn 2 branch to a Yarn 1 branch).
  variants = variants.filter(variant => {
    return !!variant.__metadata;
  });

  for (const variant of variants) {
    // Pre-lockfile v7, the entries weren't normalized (ie we had "foo@x.y.z"
    // in the lockfile rather than "foo@npm:x.y.z")
    if (variant.__metadata.version < 7) {
      for (const key of Object.keys(variant)) {
        if (key === `__metadata`)
          continue;

        const descriptor = structUtils.parseDescriptor(key, true);
        const normalizedDescriptor = configuration.normalizeDependency(descriptor);
        const newKey = structUtils.stringifyDescriptor(normalizedDescriptor);

        if (newKey !== key) {
          variant[newKey] = variant[key];
          delete variant[key];
        }
      }
    }

    // We encode the cacheKeys inside the checksums so that the reconciliation
    // can merge the data together
    for (const key of Object.keys(variant)) {
      if (key === `__metadata`)
        continue;

      const checksum = variant[key].checksum;
      if (typeof checksum === `string` && checksum.includes(`/`))
        continue;

      variant[key].checksum = `${variant.__metadata.cacheKey}/${checksum}`;
    }
  }

  const merged = Object.assign({}, ...variants);

  // We must keep the lockfile version as small as necessary to force Yarn to
  // refresh the merged-in lockfile metadata that may be missing.
  merged.__metadata.version = `${Math.min(...variants.map(variant => {
    return parseInt(variant.__metadata.version ?? 0);
  }))}`;

  // It shouldn't matter, since the cacheKey have been embed within the checksums
  merged.__metadata.cacheKey = `merged`;

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

async function autofixLegacyPlugins(configuration: Configuration, immutable: boolean) {
  if (!configuration.projectCwd)
    return false;

  const legacyPlugins: Array<PortablePath> = [];
  const yarnPluginDir = ppath.join(configuration.projectCwd, `.yarn/plugins/@yarnpkg`);

  const changed = await Configuration.updateConfiguration(configuration.projectCwd, {
    plugins: plugins => {
      if (!Array.isArray(plugins))
        return plugins;

      const filteredPlugins = plugins.filter((plugin: {spec: string, path: PortablePath}) => {
        if (!plugin.path)
          return true;

        const resolvedPath = ppath.resolve(configuration.projectCwd!, plugin.path);
        const isLegacy = LEGACY_PLUGINS.has(plugin.spec) && ppath.contains(yarnPluginDir, resolvedPath);

        if (isLegacy)
          legacyPlugins.push(resolvedPath);

        return !isLegacy;
      });

      if (filteredPlugins.length === 0)
        return Configuration.deleteProperty;

      if (filteredPlugins.length === plugins.length)
        return plugins;

      return filteredPlugins;
    },
  }, {
    immutable,
  });

  if (!changed)
    return false;

  await Promise.all(legacyPlugins.map(async pluginPath => {
    await xfs.removePromise(pluginPath);
  }));

  return true;
}
