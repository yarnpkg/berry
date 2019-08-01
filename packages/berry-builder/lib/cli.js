#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clipanion_1 = require("clipanion");
const bundle_1 = __importDefault(require("./commands/build/bundle"));
const plugin_1 = __importDefault(require("./commands/build/plugin"));
const help_1 = __importDefault(require("./commands/help"));
const plugin_2 = __importDefault(require("./commands/new/plugin"));
const cli = new clipanion_1.Cli({
    binaryName: `yarn builder`,
});
cli.register(plugin_2.default);
cli.register(bundle_1.default);
cli.register(plugin_1.default);
cli.register(help_1.default);
cli.runExit(process.argv.slice(2), {
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
});
