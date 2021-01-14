import {Filename, npath, ppath, xfs}        from '@yarnpkg/fslib';
import chalk                                from 'chalk';
import {Command, Option, Usage, UsageError} from 'clipanion';
import path                                 from 'path';

// eslint-disable-next-line arca/no-default-export
export default class NewPluginCommand extends Command {
  static paths = [
    [`new`, `plugin`],
  ];

  static usage: Usage = Command.Usage({
    description: `generate the template for a new plugin`,
    details: `
      This command generates a new plugin based on the template.
    `,
    examples: [[
      `Create a new plugin`,
      `$0 new plugin yarn-plugin-hello-world`,
    ]],
  });

  target = Option.String();

  async execute() {
    const target = npath.toPortablePath(path.resolve(this.target));
    if (await xfs.existsPromise(target)) {
      const listing = await xfs.readdirPromise(target);
      if (listing.length !== 0) {
        throw new UsageError(`The target directory (${this.target}) isn't empty; aborting the scaffolding.`);
      }
    }

    await xfs.mkdirPromise(target, {recursive: true});
    await xfs.mkdirPromise(ppath.join(target, `sources` as Filename), {recursive: true});

    await xfs.writeFilePromise(ppath.join(target, `sources/index.ts` as Filename), [
      `import {CommandContext, Plugin} from '@yarnpkg/core';\n`,
      `import {Command} from 'clipanion';\n`,
      `\n`,
      `class HelloWorldCommand extends Command<CommandContext> {\n`,
      `  static paths = [\n`,
      `    [\`hello\`, \`world\`],\n`,
      `  ];\n`,
      `\n`,
      `  name = Command.String(\`--name\`, \`John Doe\`, {\n`,
      `    description: \`Your name\`,\n`,
      `  });\n`,
      `\n`,
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

    await xfs.writeJsonPromise(ppath.join(target, `package.json` as Filename), {
      name: `yarn-plugin-helloworld`,
      main: `./sources/index.ts`,
      dependencies: {
        [`@yarnpkg/core`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/core`],
        [`@yarnpkg/builder`]: `^${require(`@yarnpkg/builder/package.json`).version}`,
        [`@types/node`]: `^${process.versions.node.split(`.`)[0]}.0.0`,
        [`clipanion`]: require(`@yarnpkg/builder/package.json`).dependencies.clipanion,
        [`typescript`]: require(`@yarnpkg/builder/package.json`).devDependencies.typescript,
      },
      scripts: {
        build: `builder build plugin`,
      },
    });

    await xfs.writeJsonPromise(ppath.join(target, `tsconfig.json` as Filename), {
      compilerOptions: {
        experimentalDecorators: true,
        module: `commonjs`,
        target: `es2018`,
        lib: [`es2018`],
      },
      include: [
        `sources/**/*.ts`,
      ],
    });

    this.context.stdout.write(`Scaffolding done! Just go into ${chalk.magenta(npath.fromPortablePath(target))} and run ${chalk.cyan(`yarn && yarn build`)} 🙂\n`);
  }
}
