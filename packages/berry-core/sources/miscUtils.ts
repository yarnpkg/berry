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

// Webpack has this annoying tendency to replace dynamic requires by a stub
// code that simply throws when called. It's all fine and dandy in the context
// of a web application, but is quite annoying when working with Node projects!

export function dynamicRequire(path: string) {
  // @ts-ignore
  if (typeof __webpack_require__ !== 'undefined') {
    // @ts-ignore
    return __non_webpack_require__(path);
  } else {
    return require(path);
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
      const comparison = layer[a].localeCompare(layer[b], `en`, {sensitivity: `variant`, caseFirst: `upper`});

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
