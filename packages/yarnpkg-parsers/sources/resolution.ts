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
  const strArr: Array<string> = [];

  if (resolution.from) {
    strArr.push(resolution.from.fullName);

    if (resolution.from.description)
      strArr.push(`@${resolution.from.description}`);

    strArr.push(`/`);
  }

  strArr.push(resolution.descriptor.fullName);

  if (resolution.descriptor.description)
    strArr.push(`@${resolution.descriptor.description}`);

  return strArr.join(``);
}
