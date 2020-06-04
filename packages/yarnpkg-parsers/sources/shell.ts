import {parse} from './grammars/shell';

export function parseShell(source: string, options: {isGlobPattern: (arg: string) => boolean} = {isGlobPattern: () => false}) {
  try {
    return parse(source, options);
  } catch (error) {
    if (error.location)
      error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
    throw error;
  }
}
