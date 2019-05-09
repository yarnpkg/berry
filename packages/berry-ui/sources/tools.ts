export function iterate(source: any, cb: (value: any, index: number, virtualIndex: number) => any, ifEmpty?: any) {
  const elements = [];
  let index = 0;

  for (const item of source) {
    const element = cb(item, index++, elements.length);

    if (element) {
      elements.push(element);
    }
  }

  if (elements.length === 0)
    return ifEmpty;

  return elements;
}
