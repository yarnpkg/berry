import {Minimatch} from 'minimatch';
import {posix}     from 'path';

export const stringPatternMatch = (
  string: string,
  patterns: Array<string>,
  {matchBase = false, dot = true}: {matchBase?: boolean, dot?: boolean} = {},
): boolean => {
  const compiledPatterns = (Array.isArray(patterns) ? patterns : [patterns]).map(
    pattern => new Minimatch(pattern, {matchBase, dot}),
  );

  // If there's only negated patterns, we assume that everything should match by default
  let status = compiledPatterns.every(compiledPattern => (compiledPattern as any).negated);

  for (const compiledPattern of compiledPatterns) {
    if ((compiledPattern as any).negated) {
      if (!status)
        continue;


      status = compiledPattern.match(string) === false;
    } else {
      if (status)
        continue;

      status = compiledPattern.match(string) === true;
    }
  }

  return status;
};

export const filePatternMatch = (
  filePath: string,
  patterns: Array<string>,
  {matchBase = true, dot = true}: {matchBase?: boolean, dot?: boolean} = {},
): boolean => {
  return exports.stringPatternMatch(posix.resolve(`/`, filePath), patterns, {matchBase, dot});
};

export const parseJsonStream = (
  stream: string,
  key?: string,
): any => {
  const lines = stream.match(/.+\n/g);
  const entries: Array<Record<string, any>> = lines!.map(line => JSON.parse(line));

  if (typeof key === `undefined`)
    return entries;

  const data: Record<string, any> = {};

  for (const entry of entries)
    data[entry[key]] = entry;

  return data;
};
