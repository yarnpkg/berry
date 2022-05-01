import {Configuration, formatUtils, structUtils} from '@yarnpkg/core';
import {diffWords}                               from 'diff';

const SIMPLE_SEMVER = /^((?:[\^~]|>=?)?)([0-9]+)(\.[0-9]+)(\.[0-9]+)((?:-\S+)?)$/;

export function colorizeVersionDiff(configuration: Configuration, from: string, to: string) {
  if (from === to)
    return to;

  const parsedFrom = structUtils.parseRange(from);
  const parsedTo = structUtils.parseRange(to);

  const matchedFrom = parsedFrom.selector.match(SIMPLE_SEMVER);
  const matchedTo = parsedTo.selector.match(SIMPLE_SEMVER);

  if (!matchedFrom || !matchedTo)
    return colorizeRawDiff(configuration, from, to);

  const SEMVER_COLORS = [
    `gray`,
    `red`,
    `yellow`,
    `green`,
    `magenta`, // prerelease
  ];

  let color: string | null = null;
  let res = ``;

  for (let t = 1; t <= SEMVER_COLORS.length; ++t) {
    if (color !== null || matchedFrom[t] !== matchedTo[t]) {
      if (color === null)
        color = SEMVER_COLORS[t - 1];

      res += formatUtils.pretty(configuration, matchedTo[t], color);
    } else {
      res += matchedTo[t];
    }
  }

  return res;
}

function colorizeRawDiff(configuration: Configuration, from: string, to: string) {
  const diff = diffWords(from, to);
  let str = ``;

  for (const part of diff) {
    if (part.added) {
      str += formatUtils.pretty(configuration, part.value, `green`);
    } else if (!part.removed) {
      str += part.value;
    }
  }

  return str;
}
