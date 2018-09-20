// @ts-ignore
import {style} from '@manaflair/term-strings';

const colorCache: Map<string, {back: {in: string, out: string}, front: {in: string, out: string}}> = new Map();

export function getColorEntry(name: string) {
  let colorEntry = colorCache.get(name);

  if (!colorEntry)
    colorCache.set(name, colorEntry = style.color(name));

  return colorEntry;
}
