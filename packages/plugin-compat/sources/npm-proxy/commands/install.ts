import {BaseCommand}           from '@yarnpkg/cli';
import {Command}               from 'clipanion';

import {enableNpmCompatOutput} from "../index";

export class InstallCommand extends BaseCommand {
  @Command.Rest()
  packages: Array<string> = [];

  //#region Ignored
  @Command.Boolean('--save')
  save!: boolean;

  @Command.Boolean('-P,--save-prod,--production')
  production!: boolean;
  //#endregion

  @Command.Boolean('-D,--save-dev')
  devDependency: boolean = false;

  @Command.Boolean('-O,--save-optional')
  optional: boolean = false;

  @Command.Path(`npm`, `install`)
  @Command.Path(`npm`, `i`)
  async execute() {
    enableNpmCompatOutput();

    return this.cli.run([
      'add',
      ...this.packages,
      ...[this.devDependency && '-D', this.optional && '-O'].filter((arg) => arg).join(' '),
    ]);
  }
}
