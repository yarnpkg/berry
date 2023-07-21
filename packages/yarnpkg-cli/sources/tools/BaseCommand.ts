import {CommandContext}  from '@yarnpkg/core';
import {npath, ppath}    from '@yarnpkg/fslib';
import {Command, Option} from 'clipanion';

export abstract class BaseCommand extends Command<CommandContext> {
  cwd = Option.String(`--cwd`, {hidden: true});

  abstract execute(): Promise<number | void>;

  validateAndExecute() {
    if (typeof this.cwd !== `undefined`)
      this.context.cwd = ppath.resolve(this.context.cwd, npath.toPortablePath(this.cwd));

    return super.validateAndExecute();
  }
}
