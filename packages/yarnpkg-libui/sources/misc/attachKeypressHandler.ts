const keypress = require(`keypress`);

/**
 * Attaches a callback function to keypress events
 * @param stdin The stdin stream
 * @param cb The callback to invoke on keypress
 */
export function attachKeypressHandler(
  stdin: NodeJS.ReadStream | undefined,
  cb: (ch: any, key: any) => void
): (() => void) | undefined {
  if (stdin) {
    keypress(stdin);
    stdin.on(`keypress`, cb);
    return () => {
      stdin.off(`keypress`, cb);
    };
  }
  return undefined;
}
