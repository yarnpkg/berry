// @ts-ignore
import {safeLoad, FAILSAFE_SCHEMA} from 'js-yaml';

import {parse}                     from './grammars/syml';

const simpleStringPattern = /^(?![-?:,\][{}#&*!|>'"%@` \t\r\n]).([ \t]*(?![,\][{}:# \t\r\n]).)*$/;

// The following keys will always be stored at the top of the object, in the
// specified order. It's not fair but life isn't fair either.
const specialObjectKeys = [`__metadata`, `version`, `resolution`, `dependencies`, `peerDependencies`, `dependenciesMeta`, `peerDependenciesMeta`, `binaries`];

class PreserveOrdering {
  constructor(public readonly data: any) {
  }
};

function stringifyString(value: string): string {
  if (value.match(simpleStringPattern)) {
    return value;
  } else {
    return JSON.stringify(value);
  }
}

function stringifyValue(value: any, indentLevel: number): string {
  if (value === null) {
    if (indentLevel === 0) {
      throw new Error(`Null is not a valid top-level value`);
    } else {
      return ` null`;
    }
  }

  if (typeof value === `number` || typeof value === `boolean`) {
    if (indentLevel === 0) {
      return `${value.toString()}\n`;
    } else {
      return ` ${value.toString()}`;
    }
  }

  if (typeof value === `string`) {
    if (indentLevel === 0) {
      return `${stringifyString(value)}\n`;
    } else {
      return ` ${stringifyString(value)}`;
    }
  }

  if (Array.isArray(value)) {
    const indent = `  `.repeat(indentLevel);

    return value.map(sub => {
      return `\n${indent}-${stringifyValue(sub, indentLevel + 1)}`;
    }).join(``);
  }

  if (typeof value === `object` && value) {
    let data: any;
    let sort: boolean;

    if (value instanceof PreserveOrdering) {
      data = value.data;
      sort = false;
    } else {
      data = value;
      sort = true;
    }

    const indent = `  `.repeat(indentLevel);

    const keys = Object.keys(data);

    if (sort) {
      keys.sort((a, b) => {
        const aIndex = specialObjectKeys.indexOf(a);
        const bIndex = specialObjectKeys.indexOf(b);

        if (aIndex === -1 && bIndex === -1)
          return a < b ? -1 : a > b ? +1 : 0;
        if (aIndex !== -1 && bIndex === -1)
          return -1;
        if (aIndex === -1 && bIndex !== -1)
          return +1;

        return aIndex - bIndex;
      });
    }

    const fields = keys.filter(key => {
      return data[key] !== undefined;
    }).map(key => {
      return `${indent}${stringifyString(key)}:${stringifyValue(data[key], indentLevel + 1)}`;
    }).join(indentLevel === 0 ? `\n\n` : `\n`);

    if (indentLevel === 0) {
      return fields ? `${fields}\n` : ``;
    } else {
      return `\n${fields}`;
    }
  }

  throw new Error(`Unsupported value type (${value})`);
}

export function stringifySyml(value: any) {
  try {
    return stringifyValue(value, 0);
  } catch (error) {
    if (error.location)
      error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
    throw error;
  }
}

stringifySyml.PreserveOrdering = PreserveOrdering;

function parseViaPeg(source: string) {
  if (!source.endsWith(`\n`))
    source += `\n`;

  return parse(source);
}

const LEGACY_REGEXP = /^(#.*(\r?\n))*?#\s+yarn\s+lockfile\s+v1\r?\n/i;

function parseViaJsYaml(source: string) {
  if (LEGACY_REGEXP.test(source))
    return parseViaPeg(source);

  let value = safeLoad(source, {
    schema: FAILSAFE_SCHEMA,
  });

  // Empty files are parsed as `undefined` instead of an empty object
  // Empty files with 2 newlines or more are `null` instead
  if (value === undefined || value === null)
    return {} as {[key: string]: string};

  if (typeof value !== `object`)
    throw new Error(`Expected an indexed object, got a ${typeof value} instead. Does your file follow Yaml's rules?`);

  if (Array.isArray(value))
    throw new Error(`Expected an indexed object, got an array instead. Does your file follow Yaml's rules?`);

  return value as {[key: string]: string};
}

export function parseSyml(source: string) {
  return parseViaJsYaml(source);
}
