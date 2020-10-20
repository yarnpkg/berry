/**
 * A recoverable shell error.
 */
export class ShellError extends Error {
  constructor(message: string) {
    super(message);

    this.name = `ShellError`;
  }
}
