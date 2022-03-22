import {PortablePath, npath, xfs} from '@yarnpkg/fslib';
import {UsageError}               from 'clipanion';
import micromatch                 from 'micromatch';
import pLimit, {Limit}            from 'p-limit';
import semver                     from 'semver';
import {Readable, Transform}      from 'stream';

/**
 * @internal
 */
export function isTaggedYarnVersion(version: string | null) {
  return !!(semver.valid(version) && version!.match(/^[^-]+(-rc\.[0-9]+)?$/));
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}

export function overrideType<T>(val: unknown): asserts val is T {
}

export function assertNever(arg: never): never {
  throw new Error(`Assertion failed: Unexpected object '${arg}'`);
}

export function validateEnum<T>(def: {[key: string]: T}, value: string): T {
  const values = Object.values(def);

  if (!values.includes(value as any))
    throw new UsageError(`Invalid value for enumeration: ${JSON.stringify(value)} (expected one of ${values.map(value => JSON.stringify(value)).join(`, `)})`);

  return value as any as T;
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

export function isIndexableObject(value: unknown): value is {[key: string]: unknown} {
  return typeof value === `object` && value !== null;
}

export type MapValue<T> = T extends Map<any, infer V> ? V : never;

export interface ToMapValue<T extends object> {
  get<K extends keyof T>(key: K): T[K];
}

export type MapValueToObjectValue<T> =
  T extends Map<infer K, infer V> ? (K extends string | number | symbol ? MapValueToObjectValue<Record<K, V>> : never)
    : T extends ToMapValue<infer V> ? MapValueToObjectValue<V>
      : T extends PortablePath ? PortablePath
        : T extends object ? {[K in keyof T]: MapValueToObjectValue<T[K]>}
          : T;

export async function allSettledSafe<T>(promises: Array<Promise<T>>) {
  const results = await Promise.allSettled(promises);
  const values: Array<T> = [];

  for (const result of results) {
    if (result.status === `rejected`) {
      throw result.reason;
    } else {
      values.push(result.value);
    }
  }

  return values;
}

/**
 * Converts Maps to indexable objects recursively.
 */
export function convertMapsToIndexableObjects<T>(arg: T): MapValueToObjectValue<T> {
  if (arg instanceof Map)
    arg = Object.fromEntries(arg);

  if (isIndexableObject(arg)) {
    for (const key of Object.keys(arg)) {
      const value = arg[key];
      if (isIndexableObject(value)) {
        // @ts-expect-error: Apparently nothing in this world can be used to index type 'T & { [key: string]: unknown; }'
        arg[key] = convertMapsToIndexableObjects(value);
      }
    }
  }

  return arg as MapValueToObjectValue<T>;
}

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

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
};

function makeDeferred(): Deferred {
  let resolve: () => void;
  let reject: (err: Error) => void;

  const promise = new Promise<void>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return {promise, resolve: resolve!, reject: reject!};
}

export class AsyncActions {
  private deferred = new Map<string, Deferred>();
  private promises = new Map<string, Promise<void>>();

  private limit: Limit;

  constructor(limit: number) {
    this.limit = pLimit(limit);
  }

  set(key: string, factory: () => Promise<void>) {
    let deferred = this.deferred.get(key);
    if (typeof deferred === `undefined`)
      this.deferred.set(key, deferred = makeDeferred());

    const promise = this.limit(() => factory());
    this.promises.set(key, promise);

    promise.then(() => {
      if (this.promises.get(key) === promise) {
        deferred!.resolve();
      }
    }, err => {
      if (this.promises.get(key) === promise) {
        deferred!.reject(err);
      }
    });

    return deferred.promise;
  }

  reduce(key: string, factory: (action: Promise<void>) => Promise<void>) {
    const promise = this.promises.get(key) ?? Promise.resolve();
    this.set(key, () => factory(promise));
  }

  async wait() {
    await Promise.all(this.promises.values());
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
    } else {
      cb(null);
    }
  }
}

// Webpack has this annoying tendency to replace dynamic requires by a stub
// code that simply throws when called. It's all fine and dandy in the context
// of a web application, but is quite annoying when working with Node projects!

const realRequire: NodeRequire = eval(`require`);

function dynamicRequireNode(path: string) {
  return realRequire(npath.fromPortablePath(path));
}

/**
 * Requires a module without using the module cache
 */
function dynamicRequireNoCache(path: string) {
  const physicalPath = npath.fromPortablePath(path);

  const currentCacheEntry = realRequire.cache[physicalPath];
  delete realRequire.cache[physicalPath];

  let result;
  try {
    result = dynamicRequireNode(physicalPath);

    const freshCacheEntry = realRequire.cache[physicalPath];

    const dynamicModule = eval(`module`) as NodeModule;
    const freshCacheIndex = dynamicModule.children.indexOf(freshCacheEntry);

    if (freshCacheIndex !== -1) {
      dynamicModule.children.splice(freshCacheIndex, 1);
    }
  } finally {
    realRequire.cache[physicalPath] = currentCacheEntry;
  }

  return result;
}

const dynamicRequireFsTimeCache = new Map<PortablePath, {
  mtime: number;
  instance: any;
}>();

/**
 * Requires a module without using the cache if it has changed since the last time it was loaded
 */
function dynamicRequireFsTime(path: PortablePath) {
  const cachedInstance = dynamicRequireFsTimeCache.get(path);
  const stat = xfs.statSync(path);

  if (cachedInstance?.mtime === stat.mtimeMs)
    return cachedInstance.instance;

  const instance = dynamicRequireNoCache(path);
  dynamicRequireFsTimeCache.set(path, {mtime: stat.mtimeMs, instance});
  return instance;
}

export enum CachingStrategy {
  NoCache,
  FsTime,
  Node,
}

export function dynamicRequire(path: string, opts?: {cachingStrategy?: CachingStrategy}): any;
export function dynamicRequire(path: PortablePath, opts: {cachingStrategy: CachingStrategy.FsTime}): any;
export function dynamicRequire(path: string | PortablePath, {cachingStrategy = CachingStrategy.Node}: {cachingStrategy?: CachingStrategy} = {}) {
  switch (cachingStrategy) {
    case CachingStrategy.NoCache:
      return dynamicRequireNoCache(path);

    case CachingStrategy.FsTime:
      return dynamicRequireFsTime(path as PortablePath);

    case CachingStrategy.Node:
      return dynamicRequireNode(path);

    default: {
      throw new Error(`Unsupported caching strategy`);
    }
  }
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
      windows: false,
      dot: true,
    }).source})`;
  }).join(`|`);
}

export function replaceEnvVariables(value: string, {env}: {env: {[key: string]: string | undefined}}) {
  const regex = /\${(?<variableName>[\d\w_]+)(?<colon>:)?(?:-(?<fallback>[^}]*))?}/g;

  return value.replace(regex, (...args) => {
    const {variableName, colon, fallback} = args[args.length - 1];

    const variableExist = Object.prototype.hasOwnProperty.call(env, variableName);
    const variableValue = env[variableName];

    if (variableValue)
      return variableValue;
    if (variableExist && !colon)
      return variableValue;
    if (fallback != null)
      return fallback;

    throw new UsageError(`Environment variable not found (${variableName})`);
  });
}

export function parseBoolean(value: unknown): boolean {
  switch (value) {
    case `true`:
    case `1`:
    case 1:
    case true: {
      return true;
    }

    case `false`:
    case `0`:
    case 0:
    case false: {
      return false;
    }

    default: {
      throw new Error(`Couldn't parse "${value}" as a boolean`);
    }
  }
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === `undefined`)
    return value;

  return parseBoolean(value);
}

export function tryParseOptionalBoolean(value: unknown): boolean | undefined | null {
  try {
    return parseOptionalBoolean(value);
  } catch {
    return null;
  }
}

export type FilterKeys<T extends {}, Filter> = {
  [K in keyof T]: T[K] extends Filter ? K : never;
}[keyof T];

export function isPathLike(value: string): boolean {
  if (npath.isAbsolute(value) || value.match(/^(\.{1,2}|~)\//))
    return true;
  return false;
}
