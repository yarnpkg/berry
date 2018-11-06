export function sortMap<T>(values: Iterable<T>, mappers: Array<(value: T) => string>) {
  const asArray = Array.from(values);

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
