import {CommandContext}              from '@yarnpkg/core';
import {Command, Option, UsageError} from 'clipanion';

export abstract class BaseCommand extends Command<CommandContext> {
  cwd = Option.String(`--cwd`, {hidden: true});

  abstract execute(): Promise<number | void>;

  validateAndExecute(): Promise<number> {
    if (typeof this.cwd !== `undefined`)
      throw new UsageError(`The --cwd option must be the very first parameter provided in the command line, before even the command path`);

    return super.validateAndExecute();
  }
}
