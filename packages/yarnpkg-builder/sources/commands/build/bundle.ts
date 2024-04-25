import {getDynamicLibs}                                                     from '@yarnpkg/cli';
import {StreamReport, MessageName, Configuration, formatUtils, structUtils} from '@yarnpkg/core';
import {npath, ppath, xfs}                                                  from '@yarnpkg/fslib';
import chalk                                                                from 'chalk';
import cp                                                                   from 'child_process';
import {Command, Option, Usage}                                             from 'clipanion';
import {build, Plugin}                                                      from 'esbuild';
import {createRequire}                                                      from 'module';
import path                                                                 from 'path';
import semver                                                               from 'semver';
import {promisify}                                                          from 'util';

import pkg                                                                  from '../../../package.json';
import {findPlugins}                                                        from '../../tools/findPlugins';

const execFile = promisify(cp.execFile);

const pkgJsonVersion = (basedir: string): string => {
  return require(`${basedir}/package.json`).version;
};

const suggestHash = async (basedir: string) => {
  try {
    const unique = await execFile(`git`, [`show`, `-s`, `--pretty=format:%ad.%h`, `--date=short`], {cwd: basedir});
    return `git.${unique.stdout.trim().replace(/-/g, ``).replace(`.`, `.hash-`)}`;
  } catch {
    return null;
  }
};

// eslint-disable-next-line arca/no-default-export
export default class BuildBundleCommand extends Command {
  static paths = [
    [`build`, `bundle`],
  ];

  static usage: Usage = Command.Usage({
    description: `build the local bundle`,
    details: `
      This command builds the local bundle - the Yarn binary file that is installed in projects.

      For more details about the build process, please consult the \`@yarnpkg/builder\` README: https://github.com/yarnpkg/berry/blob/HEAD/packages/yarnpkg-builder/README.md.
    `,
    examples: [[
      `Build the local bundle`,
      `$0 build bundle`,
    ], [
      `Build the local development bundle`,
      `$0 build bundle --no-minify`,
    ]],
  });

  profile = Option.String(`--profile`, `standard`, {
    description: `Only include plugins that are part of the the specified profile`,
  });

  plugins = Option.Array(`--plugin`, [], {
    description: `An array of plugins that should be included besides the ones specified in the profile`,
  });

  noGitHash = Option.Boolean(`--no-git-hash`, false, {
    description: `Don't include the git hash of the current commit in bundle version`,
  });

  noMinify = Option.Boolean(`--no-minify`, false, {
    description: `Build a bundle for development, without optimizations (minifying, mangling, treeshaking)`,
  });

  sourceMap = Option.Boolean(`--source-map`, false, {
    description: `Includes a source map in the bundle`,
  });

  metafile = Option.Boolean(`--metafile`, false, {
    description: `Emit a metafile next to the bundle`,
  });

  async execute() {
    const basedir = process.cwd();
    const portableBaseDir = npath.toPortablePath(basedir);

    const configuration = Configuration.create(portableBaseDir);

    const plugins = findPlugins({basedir, profile: this.profile, plugins: this.plugins.map(plugin => path.resolve(plugin))});
    const modules = [...getDynamicLibs().keys()].concat(plugins);
    const output = ppath.join(portableBaseDir, `bundles/yarn.js`);
    const metafile = this.metafile ? ppath.join(portableBaseDir, `bundles/yarn.meta.json`) : false;

    let version = pkgJsonVersion(basedir);

    const hash = !this.noGitHash
      ? await suggestHash(basedir)
      : null;

    if (hash !== null)
      version = semver.prerelease(version) !== null
        ? `${version}.${hash}`
        : `${version}-${hash}`;

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
    }, async report => {
      await report.startTimerPromise(`Building the CLI`, async () => {
        const valLoad = (p: string, values: any) => {
          const fn = require(p.replace(/.ts$/, `.val.js`));
          return fn(values).code;
        };

        const valLoader: Plugin = {
          name: `val-loader`,
          setup(build) {
            build.onLoad({filter: /[\\/]getPluginConfiguration\.ts$/}, async args => ({
              contents: valLoad(args.path, {modules, plugins}),
              loader: `default`,
            }));
          },
        };

        const res = await build({
          banner: {
            js: `#!/usr/bin/env node\n/* eslint-disable */\n//prettier-ignore`,
          },
          entryPoints: [path.join(basedir, `sources/cli.ts`)],
          bundle: true,
          define: {
            YARN_VERSION: JSON.stringify(version),
            ...(this.noMinify ? {} : {
              // For React
              'process.env.NODE_ENV': JSON.stringify(`production`),
              // For ink
              'process.env.DEV': JSON.stringify(`false`),
              // mkdirp
              'process.env.__TESTING_MKDIRP_PLATFORM__': `false`,
              'process.env.__TESTING_MKDIRP_NODE_VERSION__': `false`,
              'process.env.__FAKE_PLATFORM__': `false`,
            }),
          },
          outfile: npath.fromPortablePath(output),
          metafile: metafile !== false,
          // Default extensions + .mjs
          resolveExtensions: [`.tsx`, `.ts`, `.jsx`, `.mjs`, `.js`, `.css`, `.json`],
          logLevel: `silent`,
          format: `iife`,
          platform: `node`,
          plugins: [valLoader],
          minify: !this.noMinify,
          sourcemap: this.sourceMap ? `inline` : false,
          target: `node${semver.minVersion(pkg.engines.node)!.version}`,
        });

        for (const warning of res.warnings) {
          if (warning.location !== null)
            continue;

          report.reportWarning(MessageName.UNNAMED, warning.text);
        }


        for (const warning of res.warnings) {
          if (warning.location === null)
            continue;

          report.reportWarning(MessageName.UNNAMED, `${warning.location.file}:${warning.location.line}:${warning.location.column}`);
          report.reportWarning(MessageName.UNNAMED, `   ↳ ${warning.text}`);
        }

        await xfs.chmodPromise(output, 0o755);

        if (metafile) {
          await xfs.writeFilePromise(metafile, JSON.stringify(res.metafile));
        }
      });
    });

    report.reportSeparator();

    const Mark = formatUtils.mark(configuration);

    if (report.hasErrors()) {
      report.reportError(MessageName.EXCEPTION, `${Mark.Cross} Failed to build the CLI`);
    } else {
      report.reportInfo(null, `${Mark.Check} Done building the CLI!`);
      report.reportInfo(null, `${Mark.Question} Bundle path: ${formatUtils.pretty(configuration, output, formatUtils.Type.PATH)}`);
      report.reportInfo(null, `${Mark.Question} Bundle size: ${formatUtils.pretty(configuration, (await xfs.statPromise(output)).size, formatUtils.Type.SIZE)}`);
      report.reportInfo(null, `${Mark.Question} Bundle version: ${formatUtils.pretty(configuration, version, formatUtils.Type.REFERENCE)}`);
      if (metafile)
        report.reportInfo(null, `${Mark.Question} Bundle meta: ${formatUtils.pretty(configuration, metafile, formatUtils.Type.PATH)}`);

      report.reportSeparator();

      const basedirReq = createRequire(`${basedir}/package.json`);

      for (const plugin of plugins) {
        const {name} = basedirReq(`${plugin}/package.json`);
        report.reportInfo(null, `${chalk.yellow(`→`)} ${structUtils.prettyIdent(configuration, structUtils.parseIdent(name))}`);
      }
    }

    return report.exitCode();
  }
}
