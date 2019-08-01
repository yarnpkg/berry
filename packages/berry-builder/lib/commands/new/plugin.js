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
const fslib_1 = require("@berry/fslib");
const chalk_1 = __importDefault(require("chalk"));
const clipanion_1 = require("clipanion");
const path_1 = __importDefault(require("path"));
// eslint-disable-next-line arca/no-default-export
class NewPluginCommand extends clipanion_1.Command {
    async execute() {
        const target = fslib_1.NodeFS.toPortablePath(path_1.default.resolve(this.target));
        if (await fslib_1.xfs.existsPromise(target)) {
            const listing = await fslib_1.xfs.readdirPromise(target);
            if (listing.length !== 0) {
                throw new clipanion_1.UsageError(`The target directory (${this.target}) isn't empty; aborting the scaffolding.`);
            }
        }
        await fslib_1.xfs.mkdirpPromise(target);
        await fslib_1.xfs.mkdirpPromise(fslib_1.ppath.join(target, `sources`));
        await fslib_1.xfs.writeFilePromise(fslib_1.ppath.join(target, `sources/index.ts`), [
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
        await fslib_1.xfs.writeFilePromise(fslib_1.ppath.join(target, `package.json`), JSON.stringify({
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
        await fslib_1.xfs.writeFilePromise(fslib_1.ppath.join(target, `tsconfig.json`), JSON.stringify({
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
        this.context.stdout.write(`Scaffolding done! Just go into ${chalk_1.default.magenta(fslib_1.NodeFS.fromPortablePath(target))} and run ${chalk_1.default.cyan(`yarn && yarn build`)} 🙂\n`);
    }
}
NewPluginCommand.usage = clipanion_1.Command.Usage({
    description: `generate the template for a new plugin`,
});
__decorate([
    clipanion_1.Command.String()
], NewPluginCommand.prototype, "target", void 0);
__decorate([
    clipanion_1.Command.Path(`new`, `plugin`)
], NewPluginCommand.prototype, "execute", null);
exports.default = NewPluginCommand;
