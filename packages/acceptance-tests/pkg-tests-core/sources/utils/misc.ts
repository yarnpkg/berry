export const parseJsonStream = (
  stream: string,
  key?: string,
): any => {
  const lines = stream.match(/.+\n/g);
  const entries: Array<Record<string, any>> = lines!.map(line => JSON.parse(line));

  if (typeof key === `undefined`)
    return entries;

  const data: Record<string, any> = {};

  for (const entry of entries)
    data[entry[key]] = entry;

  return data;
};
