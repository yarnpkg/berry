import {StreamReport, MessageName, Configuration, formatUtils, structUtils} from '@yarnpkg/core';
import {pnpPlugin}                                                          from '@yarnpkg/esbuild-plugin-pnp';
import {npath, xfs}                                                         from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                                 from 'clipanion';
import {build, Plugin}                                                      from 'esbuild-wasm';
import fs                                                                   from 'fs';
import path                                                                 from 'path';

import {isDynamicLib}                                                       from '../../tools/isDynamicLib';

const matchAll = /()/;

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^/]+\/)?[^/]+)\/*(.*|)$/;

// The name gets normalized so that everyone can override some plugins by
// their own (@arcanis/yarn-plugin-foo would override @yarnpkg/plugin-foo
// as well as @mael/yarn-plugin-foo)
const getNormalizedName = (name: string) => {
  const parsing = name.match(/^(?:@yarnpkg\/|(?:@[^/]+\/)?yarn-)(plugin-[^/]+)/);
  if (parsing === null)
    throw new UsageError(`Invalid plugin name "${name}" - it should be "yarn-plugin-<something>"`);

  return `@yarnpkg/${parsing[1]}`;
};

// eslint-disable-next-line arca/no-default-export
export default class BuildPluginCommand extends Command {
  static paths = [
    [`build`, `plugin`],
  ];

  static usage: Usage = Command.Usage({
    description: `build a local plugin`,
    details: `
      This command builds a local plugin.
    `,
    examples: [[
      `Build a local plugin`,
      `$0 build plugin`,
    ], [
      `Build a local development plugin`,
      `$0 build plugin --no-minify`,
    ]],
  });

  noMinify = Option.Boolean(`--no-minify`, false, {
    description: `Build a plugin for development, without optimizations (minifying, mangling, treeshaking)`,
  });

  sourceMap = Option.Boolean(`--source-map`, false, {
    description: `Includes a source map in the bundle`,
  });

  async execute() {
    const basedir = process.cwd();
    const portableBaseDir = npath.toPortablePath(basedir);
    const configuration = Configuration.create(portableBaseDir);

    const {name: rawName, main} = require(`${basedir}/package.json`);
    const name = getNormalizedName(rawName);
    const prettyName = structUtils.prettyIdent(configuration, structUtils.parseIdent(name));
    const output = path.join(basedir, `bundles/${name}.js`);

    await xfs.mkdirPromise(npath.toPortablePath(path.dirname(output)), {recursive: true});

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      stdout: this.context.stdout,
      forgettableNames: new Set([MessageName.UNNAMED]),
    }, async report => {
      await report.startTimerPromise(`Building ${prettyName}`, async () => {
        const dynamicLibResolver: Plugin = {
          name: `dynamic-lib-resolver`,
          setup(build) {
            build.onResolve({filter: matchAll}, async args => {
              const dependencyNameMatch = args.path.match(pathRegExp);
              if (dependencyNameMatch === null)
                return undefined;

              const [, dependencyName] = dependencyNameMatch;
              if (dependencyName === name || !isDynamicLib(args.path))
                return undefined;

              return {
                path: args.path,
                external: true,
              };
            });
          },
        };

        const res = await build({
          banner: {
            js: [
              `/* eslint-disable */`,
              `//prettier-ignore`,
              `module.exports = {`,
              `name: ${JSON.stringify(name)},`,
              `factory: function (require) {`,
            ].join(`\n`),
          },
          globalName: `plugin`,
          footer: {
            js: [
              `return plugin;`,
              `}`,
              `};`,
            ].join(`\n`),
          },
          entryPoints: [path.resolve(basedir, main ?? `sources/index`)],
          bundle: true,
          outfile: output,
          logLevel: `silent`,
          plugins: [dynamicLibResolver, pnpPlugin()],
          minify: !this.noMinify,
          sourcemap: this.sourceMap ? `inline` : false,
          target: `node12`,
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
      });
    });

    report.reportSeparator();

    const Mark = formatUtils.mark(configuration);

    if (report.hasErrors()) {
      report.reportError(MessageName.EXCEPTION, `${Mark.Cross} Failed to build ${prettyName}`);
    } else {
      report.reportInfo(null, `${Mark.Check} Done building ${prettyName}!`);
      report.reportInfo(null, `${Mark.Question} Bundle path: ${formatUtils.pretty(configuration, output, formatUtils.Type.PATH)}`);
      report.reportInfo(null, `${Mark.Question} Bundle size: ${formatUtils.pretty(configuration, fs.statSync(output).size, formatUtils.Type.SIZE)}`);
    }

    return report.exitCode();
  }
}
