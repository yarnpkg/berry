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
const chalk_1 = __importDefault(require("chalk"));
const clipanion_1 = require("clipanion");
const filesize_1 = __importDefault(require("filesize"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const webpack_1 = __importDefault(require("webpack"));
const dynamicLibs_1 = require("../../data/dynamicLibs");
const findPlugins_1 = require("../../tools/findPlugins");
const makeConfig_1 = require("../../tools/makeConfig");
const pkgJsonVersion = (basedir) => {
    const pkgJson = require(`${basedir}/package.json`);
    return JSON.stringify(pkgJson["version"]);
};
// eslint-disable-next-line arca/no-default-export
class BuildBundleCommand extends clipanion_1.Command {
    constructor() {
        super(...arguments);
        this.profile = `standard`;
        this.plugins = [];
    }
    async execute() {
        const basedir = process.cwd();
        const plugins = findPlugins_1.findPlugins({ basedir, profile: this.profile, plugins: this.plugins });
        const modules = Array.from(dynamicLibs_1.dynamicLibs).concat(plugins);
        const output = `${basedir}/bundles/berry.js`;
        const compiler = webpack_1.default(makeConfig_1.makeConfig({
            context: basedir,
            entry: `./sources/cli.ts`,
            bail: true,
            output: {
                filename: path_1.default.basename(output),
                path: path_1.default.dirname(output),
            },
            module: {
                rules: [{
                        // This file is particular in that it exposes the bundle
                        // configuration to the bundle itself (primitive introspection).
                        test: path_1.default.resolve(basedir, `sources/pluginConfiguration.raw.js`),
                        use: {
                            loader: require.resolve(`val-loader`),
                            options: { modules, plugins },
                        },
                    }],
            },
            plugins: [
                new webpack_1.default.BannerPlugin({
                    entryOnly: true,
                    banner: `#!/usr/bin/env node`,
                    raw: true,
                }),
                new webpack_1.default.DefinePlugin({
                    [`BERRY_VERSION`]: pkgJsonVersion(basedir),
                }),
            ],
        }));
        const buildErrors = await new Promise((resolve, reject) => {
            compiler.run((err, stats) => {
                if (err) {
                    reject(err);
                }
                else if (stats.compilation.errors.length > 0) {
                    resolve(stats.toString(`errors-only`));
                }
                else {
                    resolve(null);
                }
            });
        });
        if (buildErrors) {
            this.context.stdout.write(`${chalk_1.default.red(`✗`)} Failed to build the CLI:\n`);
            this.context.stdout.write(`${buildErrors}\n`);
            return 1;
        }
        else {
            this.context.stdout.write(`${chalk_1.default.green(`✓`)} Done building the CLI!\n`);
            this.context.stdout.write(`${chalk_1.default.cyan(`?`)} Bundle path: ${output}\n`);
            this.context.stdout.write(`${chalk_1.default.cyan(`?`)} Bundle size: ${filesize_1.default(fs_1.default.statSync(output).size)}\n`);
            for (const plugin of plugins)
                this.context.stdout.write(`    ${chalk_1.default.yellow(`→`)} ${plugin}\n`);
            return 0;
        }
    }
}
BuildBundleCommand.usage = clipanion_1.Command.Usage({
    description: `build the local bundle`,
});
__decorate([
    clipanion_1.Command.String(`--profile`)
], BuildBundleCommand.prototype, "profile", void 0);
__decorate([
    clipanion_1.Command.Array(`--plugin`)
], BuildBundleCommand.prototype, "plugins", void 0);
__decorate([
    clipanion_1.Command.Path(`build`, `bundle`)
], BuildBundleCommand.prototype, "execute", null);
exports.default = BuildBundleCommand;
