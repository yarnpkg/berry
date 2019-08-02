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
const webpack_sources_1 = require("webpack-sources");
const webpack_1 = __importDefault(require("webpack"));
const dynamicLibs_1 = require("../../data/dynamicLibs");
const makeConfig_1 = require("../../tools/makeConfig");
const reindent_1 = require("../../tools/reindent");
// The name gets normalized so that everyone can override some plugins by
// their own (@arcanis/berry-plugin-foo would override @berry/plugin-foo
// as well as @mael/berry-plugin-foo)
const getNormalizedName = (name) => {
    const parsing = name.match(/^(?:@berry\/|(?:@[^\/]+\/)?berry-)(plugin-[^\/]+)/);
    if (parsing === null)
        throw new clipanion_1.UsageError(`Invalid plugin name "${name}" - it should be "berry-plugin-<something>"`);
    return `@berry/${parsing[1]}`;
};
// eslint-disable-next-line arca/no-default-export
class BuildPluginCommand extends clipanion_1.Command {
    async execute() {
        const basedir = process.cwd();
        const { name: rawName } = require(`${basedir}/package.json`);
        const name = getNormalizedName(rawName);
        const output = `${basedir}/bundles/${name}.js`;
        const compiler = webpack_1.default(makeConfig_1.makeConfig({
            context: basedir,
            entry: `.`,
            output: {
                filename: path_1.default.basename(output),
                path: path_1.default.dirname(output),
                libraryTarget: `var`,
                library: `plugin`,
            },
            externals: [
                (context, request, callback) => {
                    if (request !== name && dynamicLibs_1.isDynamicLib(request)) {
                        callback(null, `commonjs ${request}`);
                    }
                    else {
                        callback();
                    }
                },
            ],
            plugins: [
                // This plugin wraps the generated bundle so that it doesn't actually
                // get evaluated right now - until after we give it a custom require
                // function that will be able to fetch the dynamic modules.
                { apply: (compiler) => {
                        compiler.hooks.compilation.tap(`MyPlugin`, (compilation) => {
                            compilation.hooks.optimizeChunkAssets.tap(`MyPlugin`, (chunks) => {
                                for (const chunk of chunks) {
                                    for (const file of chunk.files) {
                                        compilation.assets[file] = new webpack_sources_1.RawSource(reindent_1.reindent(`
                    module.exports = {};

                    module.exports.factory = function (require) {
${reindent_1.reindent(compilation.assets[file].source().replace(/^ +/, ``), 11)}
                      return plugin;
                    };

                    module.exports.name = ${JSON.stringify(name)};
                  `));
                                    }
                                }
                            });
                        });
                    } },
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
        if (buildErrors !== null) {
            this.context.stdout.write(`${chalk_1.default.red(`✗`)} Failed to build ${name}:\n`);
            this.context.stdout.write(`${buildErrors}\n`);
            return 1;
        }
        else {
            this.context.stdout.write(`${chalk_1.default.green(`✓`)} Done building ${name}!\n`);
            this.context.stdout.write(`${chalk_1.default.cyan(`?`)} Bundle path: ${output}\n`);
            this.context.stdout.write(`${chalk_1.default.cyan(`?`)} Bundle size: ${filesize_1.default(fs_1.default.statSync(output).size)}\n`);
            return 0;
        }
    }
}
BuildPluginCommand.usage = clipanion_1.Command.Usage({
    description: `build the local plugin`,
});
__decorate([
    clipanion_1.Command.Path(`build`, `plugin`)
], BuildPluginCommand.prototype, "execute", null);
exports.default = BuildPluginCommand;
