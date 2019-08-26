export function reindent(text: string, level: number = 0) {
  const lines = text.replace(/^\n+/, ``).split(`\n`).map(line => {
    return line.replace(/ +$/, ``);
  });

  let minIndent = Infinity;
  for (const line of lines) {
    if (line.length !== 0) {
      const indent = line.match(/^ */)![0].length;
      if (indent < minIndent) {
        minIndent = indent;
      }
    }
  }

  return lines.map(line => {
    return line ? `  `.repeat(level) + line.slice(minIndent) : line;
  }).join(`\n`);
}
