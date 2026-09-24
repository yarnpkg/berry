import {CommandContext}              from '@yarnpkg/core';
import {Command, Option, UsageError} from 'clipanion';

export abstract class BaseCommand extends Command<CommandContext> {
  cwd = Option.String(`--cwd`, {hidden: true});

  failOnWarnings = Option.Boolean(`--fail-on-warnings`, false, {
    description: `Exit with a non-zero status code when warnings are reported`,
    hidden: true,
  });

  abstract execute(): Promise<number | void>;

  validateAndExecute(): Promise<number> {
    if (typeof this.cwd !== `undefined`)
      throw new UsageError(`The --cwd option is ambiguous when used anywhere else than the very first parameter provided in the command line, before even the command path`);

    if (this.failOnWarnings)
      this.context.failOnWarnings = true;

    return super.validateAndExecute();
  }
}
