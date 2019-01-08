import {parse} from './grammars/resolution';

export function parseResolution(source: string) {
  try {
    return parse(source);
  } catch (error) {
    if (error.location)
      error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
    throw error;
  }
}
