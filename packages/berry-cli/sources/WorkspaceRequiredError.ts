// @ts-ignore
import {UsageError} from '@manaflair/concierge';

export class WorkspaceRequiredError extends UsageError {
  constructor(cwd: string) {
    super(`This command can only be run from within a workspace of your project.`);
  }
}