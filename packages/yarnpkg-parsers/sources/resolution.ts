import {parse} from './grammars/resolution';

export type Resolution = {
  from?: {
    fullName: string;
    description?: string;
  };
  descriptor: {
    fullName: string;
    description?: string;
  };
};

export function parseResolution(source: string): Resolution {
  const legacyResolution = source.match(/^\*{1,2}\/(.*)/);
  if (legacyResolution)
    throw new Error(`The override for '${source}' includes a glob pattern. Glob patterns have been removed since their behaviours don't match what you'd expect. Set the override to '${legacyResolution[1]}' instead.`);

  try {
    return parse(source) as Resolution;
  } catch (error) {
    if (error.location)
      error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
    throw error;
  }
}

export function stringifyResolution(resolution: Resolution) {
  let str = ``;

  if (resolution.from) {
    str += resolution.from.fullName;

    if (resolution.from.description)
      str += `@${resolution.from.description}`;

    str += `/`;
  }

  str += resolution.descriptor.fullName;

  if (resolution.descriptor.description)
    str += `@${resolution.descriptor.description}`;

  return str;
}
