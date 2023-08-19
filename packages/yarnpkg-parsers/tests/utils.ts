export function joinYaml(lines: Array<string>): string {
  return `${lines.join(`\n`)}\n`;
}
