export type ShellErrorOptions = {
  recoverable: boolean;
};

export class ShellError extends Error {
  public recoverable: boolean;

  constructor(message: string, {recoverable}: ShellErrorOptions) {
    super(message);

    this.name = `ShellError`;
    this.recoverable = recoverable;
  }
}
