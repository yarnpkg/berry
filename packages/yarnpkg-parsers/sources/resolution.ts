import {parse} from './grammars/resolution';

export type Resolution = {
  from?: {
    fullName: string,
    description?: string,
  },
  descriptor: {
    fullName: string,
    description?: string,
  },
};

export function parseResolution(source: string): Resolution {
  if (source.indexOf('**') !== -1)
    throw new Error(`The resolution '${source}' includes a glob pattern which is discouraged in v2 since it has no longer an effect.`)

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
