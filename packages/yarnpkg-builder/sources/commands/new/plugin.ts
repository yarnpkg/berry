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

      For more details about the build process, please consult the \`@yarnpkg/builder\` README: https://github.com/yarnpkg/berry/blob/HEAD/packages/yarnpkg-builder/README.md.
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
      `import {Plugin} from '@yarnpkg/core';\n`,
      `import {BaseCommand} from '@yarnpkg/cli';\n`,
      `import {Option} from 'clipanion';\n`,
      `\n`,
      `class HelloWorldCommand extends BaseCommand {\n`,
      `  static paths = [\n`,
      `    [\`hello\`, \`world\`],\n`,
      `  ];\n`,
      `\n`,
      `  name = Option.String(\`--name\`, \`John Doe\`, {\n`,
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
        [`@yarnpkg/cli`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/cli`],
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
        target: `ES2019`,
        lib: [`ES2019`],
      },
      include: [
        `sources/**/*.ts`,
      ],
    });

    this.context.stdout.write(`Scaffolding done! Just go into ${chalk.magenta(npath.fromPortablePath(target))} and run ${chalk.cyan(`yarn && yarn build`)} 🙂\n`);
  }
}
