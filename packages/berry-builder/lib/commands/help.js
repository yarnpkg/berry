"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const clipanion_1 = require("clipanion");
// eslint-disable-next-line arca/no-default-export
class HelpCommand extends clipanion_1.Command {
    async execute() {
        this.context.stdout.write(this.cli.usage(null));
    }
}
__decorate([
    clipanion_1.Command.Path(`--help`),
    clipanion_1.Command.Path(`-h`)
], HelpCommand.prototype, "execute", null);
exports.default = HelpCommand;
