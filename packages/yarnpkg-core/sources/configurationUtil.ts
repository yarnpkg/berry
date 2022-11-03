declare global {
  interface Array<T> {
    findLastIndex(
      predicate: (value: T, index: number, obj: Array<T>) => unknown,
      thisArg?: any,
    ): number;
  }
}

type ConflictMarker = {
  onConflict: string;
  [key: string]: unknown;
};

type ConflictMarkerWithValue = {
  onConflict: string;
  value: unknown;
};

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === `object` && data !== null && !Array.isArray(data);
}

enum ValueType {
  Object,
  Array,
  Literal,
  Undefined,
}

function getValueType(data: unknown) {
  if (typeof data === `undefined`)
    return ValueType.Undefined;

  if (isObject(data))
    return ValueType.Object;

  if (Array.isArray(data))
    return ValueType.Array;

  return ValueType.Literal;
}

function hasProperty<T extends string>(data: Record<string, unknown>, key: T): data is {[key in T]: unknown} {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function isConflictMarker(data: unknown): data is ConflictMarker {
  return isObject(data) && hasProperty(data, `onConflict`) && typeof data.onConflict === `string`;
}

function normalizeValue(data: unknown) {
  if (typeof data === `undefined`)
    return {onConflict: `default`, value: data};

  if (!isConflictMarker(data))
    return {onConflict: `default`, value: data};

  if (hasProperty(data, `value`))
    return data;

  const {onConflict, ...value} = data;
  return {onConflict, value};
}

function getNormalized(data: unknown, key: string): ConflictMarkerWithValue {
  const rawValue = isObject(data) && hasProperty(data, key)
    ? data[key]
    : undefined;

  return normalizeValue(rawValue);
}

function attachIdToTree(data: unknown, id: string): [string, unknown] {
  if (isObject(data)) {
    const result: Record<string, any> = {};

    for (const key of Object.keys(data))
      result[key] = attachIdToTree(data[key], id);

    return [id, result];
  }

  if (Array.isArray(data))
    return [id, data.map(item => attachIdToTree(item, id))];

  return [id, data];
}

function resolveValueAt(rcFiles: Array<[string, unknown]>, path: Array<string>, key: string, firstVisiblePosition: number, resolveAtPosition: number): [string, unknown] | null {
  const nextIterationValues = rcFiles.map<[string, unknown]>(([id, data]) => {
    return [id, getNormalized(data, key).value];
  });

  let expectedValueType: ValueType | undefined;

  const relevantValues: Array<[string, unknown]> = [];

  let lastRelevantPosition = resolveAtPosition;
  let currentResetPosition = 0;

  for (let t = resolveAtPosition - 1; t >= firstVisiblePosition; --t) {
    const [id, data] = rcFiles[t];
    const {onConflict, value} = getNormalized(data, key);

    const valueType = getValueType(value);
    if (valueType === ValueType.Undefined)
      continue;

    expectedValueType ??= valueType;

    if (valueType !== expectedValueType || onConflict === `hardReset`) {
      currentResetPosition = lastRelevantPosition;
      break;
    }

    if (valueType === ValueType.Literal)
      return [id, value];

    relevantValues.unshift([id, value]);

    if (onConflict === `reset`) {
      currentResetPosition = t;
      break;
    }

    if (onConflict === `extend` && t === firstVisiblePosition)
      firstVisiblePosition = 0;

    lastRelevantPosition = t;
  }

  if (typeof expectedValueType === `undefined`)
    return null;

  const id = relevantValues[relevantValues.length - 1][0];
  switch (expectedValueType) {
    case ValueType.Array:
      return [id, new Array<unknown>().concat(...relevantValues.map(([id, value]) => (value as Array<unknown>).map(item => attachIdToTree(item, id))))];

    case ValueType.Object:
      const conglomerate = Object.assign({}, ...relevantValues.map(([, value]) => value));
      const keys = Object.keys(conglomerate);
      const result: Record<string, unknown> = {};

      const hardResetLocation = nextIterationValues.findLastIndex(([id, value]) => {
        const valueType = getValueType(value);
        return valueType !== ValueType.Object && valueType !== ValueType.Undefined;
      });

      if (hardResetLocation !== -1) {
        const slice = nextIterationValues.slice(hardResetLocation + 1);
        for (const key of keys) {
          result[key] = resolveValueAt(slice, path, key, 0, slice.length);
        }
      } else {
        for (const key of keys) {
          result[key] = resolveValueAt(nextIterationValues, path, key, currentResetPosition, nextIterationValues.length);
        }
      }

      return [id, result];

    default:
      throw new Error(`Assertion failed: Non-extendable value type`);
  }
}

// Given an array of configuration files represented as tuples, which each
// contains both an ID (for example the configuration file path) and an
// arbitrary value, this function will traverse the whole tree to resolve
// all `onConflict` directives.
//
// The returned value will recursively be turned into tuples, which each
// contain both the ID of the configuration file that contributed the last
// entry to the value and the final value.
//
export function resolveRcFiles(rcFiles: Array<[string, unknown]>) {
  return resolveValueAt(rcFiles.map(([id, data]) => [id, {[`.`]: data}]), [], `.`, 0, rcFiles.length);
}
