import {UsageError} from 'clipanion';

export class WorkspaceRequiredError extends UsageError {
  constructor(cwd: string) {
    super(`This command can only be run from within a workspace of your project.`);
  }
}