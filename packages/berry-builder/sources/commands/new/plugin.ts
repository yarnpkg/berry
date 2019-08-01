import {Filename, NodeFS, ppath, xfs} from '@berry/fslib';
import chalk                          from 'chalk';
import {Command, UsageError}          from 'clipanion';
import path                           from 'path';

// eslint-disable-next-line arca/no-default-export
export default class NewPluginCommand extends Command {
  @Command.String()
  target!: string;

  static usage = Command.Usage({
    description: `generate the template for a new plugin`,
  });

  @Command.Path(`new`, `plugin`)
  async execute() {
    const target = NodeFS.toPortablePath(path.resolve(this.target));
    if (await xfs.existsPromise(target)) {
      const listing = await xfs.readdirPromise(target);
      if (listing.length !== 0) {
        throw new UsageError(`The target directory (${this.target}) isn't empty; aborting the scaffolding.`);
      }
    }

    await xfs.mkdirpPromise(target);
    await xfs.mkdirpPromise(ppath.join(target, `sources` as Filename));

    await xfs.writeFilePromise(ppath.join(target, `sources/index.ts` as Filename), [
      `import {CommandContext, Plugin} from '@berry/core';\n`,
      `import {Command} from 'clipanion';\n`,
      `\n`,
      `class HelloWorldCommand extends Command<CommandContext> {\n`,
      `  @Command.String(\`--name\`)\n`,
      `  name: string = \`John Doe\`;\n`,
      `\n`,
      `  @Command.Path(\`hello\`, \`world\`)\n`,
      `  async execute() {\n`,
      `    console.log(\`Hello \${this.name}!\`);\n`,
      `  }\n`,
      `}\n`,
      `\n`,
      `const plugin: Plugin = {\n`,
      `  hooks: {\n`,
      `    afterAllInstalled: () => {\n`,
      `      console.log(\`What a great install, am I right?\`);\n`,
      `    },\n`,
      `  },\n`,
      `  commands: [\n`,
      `    HelloWorldCommand,\n`,
      `  ],\n`,
      `};\n`,
      `\n`,
      `export default plugin;\n`,
    ].join(``));

    await xfs.writeFilePromise(ppath.join(target, `package.json` as Filename), JSON.stringify({
      name: `berry-plugin-helloworld`,
      main: `./sources/index.ts`,
      dependencies: {
        [`@berry/core`]: require(`@berry/builder/package.json`).dependencies[`@berry/core`],
        [`@berry/builder`]: `^${require(`@berry/builder/package.json`).version}`,
        [`@types/node`]: `^${process.versions.node.split(`.`)[0]}.0.0`,
        [`clipanion`]: require(`@berry/builder/package.json`).dependencies[`clipanion`],
        [`typescript`]: `^3.3.3333`,
      },
      scripts: {
        build: `yarn builder build plugin`,
      },
    }, null, 2));

    await xfs.writeFilePromise(ppath.join(target, `tsconfig.json` as Filename), JSON.stringify({
      compilerOptions: {
        experimentalDecorators: true,
        module: `commonjs`,
        target: `es2017`,
        lib: [`es2017`],
      },
      include: [
        `sources/**/*.ts`,
      ],
    }, null, 2));

    this.context.stdout.write(`Scaffolding done! Just go into ${chalk.magenta(NodeFS.fromPortablePath(target))} and run ${chalk.cyan(`yarn && yarn build`)} 🙂\n`);
  }
}
