import {npath, ppath, xfs}                  from '@yarnpkg/fslib';
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
    await xfs.mkdirPromise(ppath.join(target, `sources`), {recursive: true});

    await xfs.writeFilePromise(ppath.join(target, `sources`, `index.ts`), [
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

    await xfs.writeFilePromise(ppath.join(target, `.gitignore`), `bundles/\n`);

    await xfs.writeJsonPromise(ppath.join(target, `package.json`), {
      name: `yarn-plugin-helloworld`,
      private: true,
      main: `./sources/index.ts`,
      dependencies: {
        [`@yarnpkg/cli`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/cli`],
        [`@yarnpkg/core`]: require(`@yarnpkg/builder/package.json`).dependencies[`@yarnpkg/core`],
        [`clipanion`]: require(`@yarnpkg/builder/package.json`).dependencies.clipanion,
      },
      devDependencies: {
        [`@types/node`]: `^${process.versions.node.split(`.`)[0]}.0.0`,
        [`@yarnpkg/builder`]: `^${require(`@yarnpkg/builder/package.json`).version}`,
        [`rimraf`]: `5.0.0`,
        [`typescript`]: require(`@yarnpkg/builder/package.json`).devDependencies.typescript,
      },
      scripts: {
        [`build`]: `builder build plugin`,
        [`build:dev`]: `builder build plugin --no-minify`,
        [`clean`]: `rimraf bundles`,
      },
    });

    await xfs.writeJsonPromise(ppath.join(target, `tsconfig.json`), {
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
