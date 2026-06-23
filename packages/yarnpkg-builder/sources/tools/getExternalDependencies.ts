import {UsageError} from 'clipanion';
import {readFileSync} from 'fs';
import path from 'path';

export const getExternalDependencies = ({cwd, external, externalFile}: {
  cwd: string;
  external: Array<string>;
  externalFile?: string;
}) => {
  if (typeof externalFile === `undefined`)
    return external;

  const externalFilePath = path.isAbsolute(externalFile)
    ? externalFile
    : path.resolve(cwd, externalFile);

  const parsed = JSON.parse(readFileSync(externalFilePath, `utf8`));

  if (!Array.isArray(parsed) || !parsed.every(value => typeof value === `string`))
    throw new UsageError(`External dependency file must contain a JSON array of strings`);

  return [...external, ...parsed];
};
