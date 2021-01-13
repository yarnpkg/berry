import {CommandContext}  from '@yarnpkg/core';
import {Command, Option} from 'clipanion';

export abstract class BaseCommand extends Command<CommandContext> {
  cwd = Option.String(`--cwd`, {hidden: true});

  abstract execute(): Promise<number | void>;
}
