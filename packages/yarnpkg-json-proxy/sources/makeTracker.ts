const VERSION = Symbol(`Version`);

function cloneObject(obj: Object): Object {
  // Preserving the prototype is out of scope for this library; don't try to
  // implement it, I won't merge it
  return Object.assign(Object.create(null), obj);
}

function cloneValue(value: any): any {
  if (typeof value === `object` && value !== null) {
    if (Array.isArray(value)) {
      return value.slice();
    } else if (value instanceof Set) {
      return new Set(value);
    } else if (value instanceof Map) {
      return new Map(value);
    } else {
      return cloneObject(value);
    }
  } else {
    return value;
  }
}

function cloneValueChecked(value: any, version: Object) {
  if (typeof value === `object` && value !== null) {
    if (value[VERSION] === version)
      return value;

    const clone = cloneValue(value);
    clone[VERSION] = version;

    return clone;
  } else {
    return cloneValue(value);
  }
}

function cloneValueDeep(value: any, filter: TrackingFilter): any {
  if (typeof value === `object` && value !== null) {
    if (Array.isArray(value)) {
      return value.map(subValue => {
        return cloneValueDeep(subValue, filter);
      });
    } else if (value instanceof Set) {
      const clone = new Set();

      for (const subValue of value.values())
        clone.add(cloneValueDeep(subValue, filter));

      return clone;
    } else if (value instanceof Map) {
      const clone = new Map();

      for (const [key, subValue] of value)
        clone.set(key, cloneValueDeep(subValue, filter));

      return clone;
    } else {
      const clone = cloneObject(value);

      for (const key of Object.keys(clone)) {
        if (filter !== true && !filter[key])
          continue;

        const nextFilter = filter !== true
          ? filter[key]
          : true;

        // @ts-expect-error
        clone[key] = cloneValueDeep(clone[key], nextFilter);
      }

      return clone;
    }
  } else {
    return value;
  }
}

function compareValuesDeep(a: any, b: any): boolean {
  if (a === b) {
    return true;
  } else if ((a == null) !== (b == null)) {
    return false;
  } else if (Array.isArray(a)) {
    if (!Array.isArray(b))
      return false;
    if (a.length !== b.length)
      return false;

    for (let t = 0, T = a.length; t < T; ++t)
      if (!compareValuesDeep(a[t], b[t]))
        return false;

    return true;
  } else if (a instanceof Set) {
    if (!(b instanceof Set))
      return false;
    if (a.size !== b.size)
      return false;

    for (const key of a.entries())
      if (!b.has(key))
        return false;

    return true;
  } else if (a instanceof Map) {
    if (!(b instanceof Map))
      return false;
    if (a.size !== b.size)
      return false;

    for (const [key, value] of a.entries())
      if (!compareValuesDeep(value, b.get(key)))
        return false;

    return true;
  } else if (a.constructor === Object) {
    if (b.constructor !== Object)
      return false;

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length)
      return false;

    for (let t = 0, T = aKeys.length; t < T; ++t)
      if (aKeys[t] !== bKeys[t])
        return false;

    for (let t = 0, T = aKeys.length; t < T; ++t)
      if (!compareValuesDeep(a[aKeys[t]], b[bKeys[t]]))
        return false;

    return true;
  } else {
    return false;
  }
}

const proxyHandlerSet = (version: TrackingVersion, filter: TrackingFilter, ensureCloning: () => Set<any>) => ({
  get(source: Set<any>, prop: string | number | symbol): any {
    switch (prop) {
      case `clear`: return () => {
        const clonedParent = ensureCloning();
        clonedParent.clear();

        source.clear();
      };

      case `delete`: return (key: any) => {
        const clonedParent = ensureCloning();
        clonedParent.delete(key);

        source.delete(key);
      };

      case `add`: return (key: any) => {
        const clonedParent = ensureCloning();
        clonedParent.add(key);

        source.add(key);
      };

      // @ts-expect-error
      default: return source[prop];
    }
  },
});

const proxyHandlerMap = (version: TrackingVersion, filter: TrackingFilter, ensureCloning: () => Map<any, any>) => ({
  get(source: Map<any, any>, prop: string | number | symbol): any {
    switch (prop) {
      case `clear`: return () => {
        const clonedParent = ensureCloning();
        clonedParent.clear();

        source.clear();
      };

      case `delete`: return (key: any) => {
        const clonedParent = ensureCloning();
        clonedParent.delete(key);

        source.delete(key);
      };

      case `set`: return (key: any, value: any) => {
        const clonedParent = ensureCloning();
        clonedParent.set(key, value);

        source.set(key, value);
      };

      case `get`: return (key: any) => {
        const value = source.get(key);

        return makeValueObservable(value, version, filter, () => {
          const clonedParent = ensureCloning();

          const immutableValue = clonedParent.get(key);
          const clonedValue = cloneValueChecked(immutableValue, version);

          clonedParent.set(key, clonedValue);

          return clonedParent;
        });
      };

      // @ts-expect-error
      default: return source[prop];
    }
  },
});

const proxyHandlerObject = (version: TrackingVersion, filter: TrackingFilter, ensureCloning: () => Object) => ({
  get(source: Object, prop: string | number | symbol): any {
    // @ts-expect-error
    const value = source[prop];

    // Typescript doesn't allow symbol in its index types
    if (typeof prop === `symbol`)
      return value;

    if (filter !== true && !filter[prop])
      return value;

    const nextFilter = filter !== true
      ? filter[prop]
      : true;

    return makeValueObservable(value, version, nextFilter, () => {
      const clonedParent = ensureCloning();

      // @ts-expect-error
      const immutableValue = clonedParent[prop];
      const clonedValue = cloneValueChecked(immutableValue, version);

      // @ts-expect-error
      clonedParent[prop] = clonedValue;

      return clonedValue;
    });
  },
  set(source: Object, prop: string | number | symbol, value: any): boolean {
    // @ts-expect-error
    const currentValue = source[prop];

    if (!compareValuesDeep(currentValue, value)) {
      // We ensure that our parent is cloned, then assign the new value into it
      const clonedParent = ensureCloning();

      // @ts-expect-error
      clonedParent[prop] = cloneValueDeep(value, filter);
    }

    // @ts-expect-error
    source[prop] = value;

    return true;
  },
});

function makeValueObservable(value: any, version: TrackingVersion, filter: TrackingFilter, ensureCloning: () => any): any {
  if (typeof value === `object` && value !== null) {
    if (value instanceof Set) {
      return new Proxy(value, proxyHandlerSet(version, filter, ensureCloning));
    } else if (value instanceof Map) {
      return new Proxy(value, proxyHandlerMap(version, filter, ensureCloning));
    } else {
      return new Proxy(value, proxyHandlerObject(version, filter, ensureCloning));
    }
  } else {
    return value;
  }
}

export type TrackingVersion = Object;
export type TrackingFilter = true | TrackingFilterObject;
interface TrackingFilterObject {
  [key: string]: TrackingFilter;
}

export type Tracker<T> = (cb: (value: T) => void) => T;

export function makeTracker<T>(value: T, filter: TrackingFilter = true) {
  const tracker = {
    immutable: cloneValueDeep(value, filter) as T,

    open(cb: (value: T) => void) {
      // A value guaranteed to be different from everything except itself
      const version = {};

      cb(makeValueObservable(value, version, filter, () => {
        tracker.immutable = cloneValueChecked(tracker.immutable, version);
        return tracker.immutable;
      }));

      return tracker.immutable;
    },
  };

  return tracker;
}
