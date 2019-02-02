export type CommandSegment = string |
  {type: `shell`, shell: ShellLine, quoted: boolean} |
  {type: `variable`, name: string, quoted: boolean};

export type CommandChain = {
  args: Array<Array<CommandSegment>>,
  then?: {type: '|&' | '|', chain: CommandChain},
};

export type CommandLine = {
  chain: CommandChain,
  then?: {type: '&&' | '||', line: CommandLine},
};

export type ShellLine = Array<CommandLine>;

export declare const parse: (code: string) => ShellLine;
