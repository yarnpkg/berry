import { ObjectPrototypeHasOwnProperty } from './primordials.js';

export function filterOwnProperties(source, keys) {
  const filtered = Object.create(null);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (ObjectPrototypeHasOwnProperty(source, key)) {
      filtered[key] = source[key];
    }
  }

  return filtered;
}
