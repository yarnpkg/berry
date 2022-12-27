import {Manifest, miscUtils, nodeUtils} from '@yarnpkg/core';
import {PortablePath}                   from '@yarnpkg/fslib';
import toPath                           from 'lodash/toPath';

export type ProcessResult = {
  manifestUpdates: Map<PortablePath, Map<string, Map<any, Set<nodeUtils.Caller>>>>;
  reportedErrors: Map<PortablePath, Array<string>>;
};

export interface Engine {
  process(): Promise<ProcessResult | null>;
}

export class Index<T extends Record<keyof T, any>> {
  private items: Array<T> = [];

  private indexes: {
    [K in keyof T]?: Map<any, Array<T>>;
  } = {};

  constructor(private indexedFields: Array<keyof T>) {
    this.clear();
  }

  clear() {
    this.items = [];

    for (const field of this.indexedFields) {
      this.indexes[field] = new Map();
    }
  }

  insert(item: T) {
    this.items.push(item);

    for (const field of this.indexedFields) {
      const value = Object.prototype.hasOwnProperty.call(item, field)
        ? item[field]
        : undefined;

      if (typeof value === `undefined`)
        continue;

      const list = miscUtils.getArrayWithDefault(this.indexes[field]!, value);
      list.push(item);
    }

    return item;
  }

  find(filter?: {[K in keyof T]?: any}) {
    if (typeof filter === `undefined`)
      return this.items;

    const filterEntries = Object.entries(filter);
    if (filterEntries.length === 0)
      return this.items;

    const sequentialFilters: Array<[keyof T, any]> = [];

    let matches: Set<T> | undefined;
    for (const [field_, value] of filterEntries) {
      const field = field_ as keyof T;

      const index = Object.prototype.hasOwnProperty.call(this.indexes, field)
        ? this.indexes[field]
        : undefined;

      if (typeof index === `undefined`) {
        sequentialFilters.push([field, value]);
        continue;
      }

      const filterMatches = new Set(index.get(value) ?? []);
      if (filterMatches.size === 0)
        return [];

      if (typeof matches === `undefined`) {
        matches = filterMatches;
      } else {
        for (const item of matches) {
          if (!filterMatches.has(item)) {
            matches.delete(item);
          }
        }
      }

      if (matches.size === 0) {
        break;
      }
    }

    let result = [...matches ?? []];
    if (sequentialFilters.length > 0) {
      result = result.filter(item => {
        for (const [field, value] of sequentialFilters) {
          const valid = typeof value !== `undefined`
            ? Object.prototype.hasOwnProperty.call(item, field) && item[field] === value
            : Object.prototype.hasOwnProperty.call(item, field) === false;

          if (!valid) {
            return false;
          }
        }

        return true;
      });
    }

    return result;
  }
}

const numberRegExp = /^[0-9]+$/;
const identifierRegExp = /^[a-zA-Z0-9_]+$/;
const knownDictKeys = new Set<string>([`scripts`, ...Manifest.allDependencies]);

function isKnownDict(parts: Array<string>, index: number) {
  return index === 1 && knownDictKeys.has(parts[0]);
}

export function normalizePath(p: Array<string> | string) {
  const parts = Array.isArray(p)
    ? p
    : toPath(p);

  const normalizedParts = parts.map((part, t) => {
    if (numberRegExp.test(part))
      return `[${part}]`;

    if (identifierRegExp.test(part) && !isKnownDict(parts, t))
      return `.${part}`;

    return `[${JSON.stringify(part)}]`;
  });

  return normalizedParts.join(``).replace(/^\./, ``);
}
