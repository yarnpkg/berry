import {PortablePath, npath} from '@yarnpkg/fslib';
import {UsageError}          from 'clipanion';
import micromatch            from 'micromatch';
import {Readable, Transform} from 'stream';

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}

export function assertNever(arg: never): never {
  throw new Error(`Assertion failed: Unexpected object '${arg}'`);
}

export function mapAndFilter<In, Out>(iterable: Iterable<In>, cb: (value: In) => Out | typeof mapAndFilterSkip): Array<Out> {
  const output: Array<Out> = [];

  for (const value of iterable) {
    const out = cb(value);
    if (out !== mapAndFilterSkip) {
      output.push(out);
    }
  }

  return output;
}

const mapAndFilterSkip = Symbol();
mapAndFilter.skip = mapAndFilterSkip;

export function mapAndFind<In, Out>(iterable: Iterable<In>, cb: (value: In) => Out | typeof mapAndFindSkip): Out | undefined {
  for (const value of iterable) {
    const out = cb(value);
    if (out !== mapAndFindSkip) {
      return out;
    }
  }

  return undefined;
}

const mapAndFindSkip = Symbol();
mapAndFind.skip = mapAndFindSkip;

export function getFactoryWithDefault<K, T>(map: Map<K, T>, key: K, factory: () => T) {
  let value = map.get(key);

  if (typeof value === `undefined`)
    map.set(key, value = factory());

  return value;
}

export function getArrayWithDefault<K, T>(map: Map<K, Array<T>>, key: K) {
  let value = map.get(key);

  if (typeof value === `undefined`)
    map.set(key, value = []);

  return value;
}

export function getSetWithDefault<K, T>(map: Map<K, Set<T>>, key: K) {
  let value = map.get(key);

  if (typeof value === `undefined`)
    map.set(key, value = new Set<T>());

  return value;
}

export function getMapWithDefault<K, MK, MV>(map: Map<K, Map<MK, MV>>, key: K) {
  let value = map.get(key);

  if (typeof value === `undefined`)
    map.set(key, value = new Map<MK, MV>());

  return value;
}

// Executes a chunk of code and calls a cleanup function once it returns (even
// if it throws an exception)

export async function releaseAfterUseAsync<T>(fn: () => Promise<T>, cleanup?: (() => any) | null) {
  if (cleanup == null)
    return await fn();

  try {
    return await fn();
  } finally {
    await cleanup();
  }
}

// Executes a chunk of code but slightly modify its exception message if it
// throws something

export async function prettifyAsyncErrors<T>(fn: () => Promise<T>, update: (message: string) => string) {
  try {
    return await fn();
  } catch (error) {
    error.message = update(error.message);
    throw error;
  }
}

// Same thing but synchronous

export function prettifySyncErrors<T>(fn: () => T, update: (message: string) => string) {
  try {
    return fn();
  } catch (error) {
    error.message = update(error.message);
    throw error;
  }
}

// Converts a Node stream into a Buffer instance

export async function bufferStream(stream: Readable) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Array<Buffer> = [];

    stream.on(`error`, error => {
      reject(error);
    });

    stream.on(`data`, chunk => {
      chunks.push(chunk);
    });

    stream.on(`end`, () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

// A stream implementation that buffers a stream to send it all at once

export class BufferStream extends Transform {
  private readonly chunks: Array<Buffer> = [];

  _transform(chunk: Buffer, encoding: string, cb: any) {
    if (encoding !== `buffer` || !Buffer.isBuffer(chunk))
      throw new Error(`Assertion failed: BufferStream only accept buffers`);

    this.chunks.push(chunk as Buffer);

    cb(null, null);
  }

  _flush(cb: any) {
    cb(null, Buffer.concat(this.chunks));
  }
}

// A stream implementation that prints a message if nothing was output

export class DefaultStream extends Transform {
  private readonly ifEmpty: Buffer;

  public active = true;

  constructor(ifEmpty: Buffer = Buffer.alloc(0)) {
    super();

    this.ifEmpty = ifEmpty;
  }

  _transform(chunk: Buffer, encoding: string, cb: any) {
    if (encoding !== `buffer` || !Buffer.isBuffer(chunk))
      throw new Error(`Assertion failed: DefaultStream only accept buffers`);

    this.active = false;
    cb(null, chunk);
  }

  _flush(cb: any) {
    if (this.active && this.ifEmpty.length > 0) {
      cb(null, this.ifEmpty);
    }
  }
}

// Webpack has this annoying tendency to replace dynamic requires by a stub
// code that simply throws when called. It's all fine and dandy in the context
// of a web application, but is quite annoying when working with Node projects!

export function dynamicRequire(path: string) {
  // @ts-ignore
  if (typeof __non_webpack_require__ !== `undefined`) {
    // @ts-ignore
    return __non_webpack_require__(path);
  } else {
    return require(path);
  }
}

export function dynamicRequireNoCache(path: PortablePath) {
  const physicalPath = npath.fromPortablePath(path);

  const currentCacheEntry = require.cache[physicalPath];
  delete require.cache[physicalPath];

  let result;
  try {
    result = dynamicRequire(physicalPath);

    const freshCacheEntry = require.cache[physicalPath];
    const freshCacheIndex = module.children.indexOf(freshCacheEntry);

    if (freshCacheIndex !== -1) {
      module.children.splice(freshCacheIndex, 1);
    }
  } finally {
    require.cache[physicalPath] = currentCacheEntry;
  }

  return result;
}

// This function transforms an iterable into an array and sorts it according to
// the mapper functions provided as parameter. The mappers are expected to take
// each element from the iterable and generate a string from it, that will then
// be used to compare the entries.
//
// Using sortMap is more efficient than kinda reimplementing the logic in a sort
// predicate because sortMap caches the result of the mappers in such a way that
// they are guaranteed to be executed exactly once for each element.

export function sortMap<T>(values: Iterable<T>, mappers: ((value: T) => string) | Array<(value: T) => string>) {
  const asArray = Array.from(values);

  if (!Array.isArray(mappers))
    mappers = [mappers];

  const stringified: Array<Array<string>> = [];

  for (const mapper of mappers)
    stringified.push(asArray.map(value => mapper(value)));

  const indices = asArray.map((_, index) => index);

  indices.sort((a, b) => {
    for (const layer of stringified) {
      const comparison = layer[a] < layer[b] ? -1 : layer[a] > layer[b] ? +1 : 0;

      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });

  return indices.map(index => {
    return asArray[index];
  });
}

/**
 * Combines an Array of glob patterns into a regular expression.
 *
 * @param ignorePatterns An array of glob patterns
 *
 * @returns A `string` representing a regular expression or `null` if no glob patterns are provided
 */
export function buildIgnorePattern(ignorePatterns: Array<string>) {
  if (ignorePatterns.length === 0)
    return null;

  return ignorePatterns.map(pattern => {
    return `(${micromatch.makeRe(pattern, {
      // @ts-ignore
      windows: false,
    }).source})`;
  }).join(`|`);
}

export function replaceEnvVariables(value: string, {env}: {env: {[key: string]: string | undefined}}) {
  const regex = /\${(?<variableName>[\d\w_]+)(?<colon>:)?-?(?<fallback>[^}]+)?}/g;

  return value.replace(regex, (...args) => {
    const {variableName, colon, fallback} = args[args.length - 1];

    const variableExist = Object.prototype.hasOwnProperty.call(env, variableName);
    const variableValue = process.env[variableName];

    if (variableValue)
      return variableValue;
    if (variableExist && !variableValue && colon)
      return fallback;
    if (variableExist)
      return variableValue;
    if (fallback)
      return fallback;

    throw new UsageError(`Environment variable not found (${variableName})`);
  });
}

