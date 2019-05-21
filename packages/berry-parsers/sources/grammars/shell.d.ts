export type CommandSegment = string |
{type: `shell`, shell: ShellLine, quoted: boolean} |
{type: `variable`, name: string, quoted: boolean};

export type EnvSegment = {
  type: `envVar`,
  name: string,
  args: Array<Array<CommandSegment>>,
};

export type Command = {
  type: `command`,
  args: Array<Array<CommandSegment>>,
  env: Array<EnvSegment>,
} | {
  type: `subshell`,
  subshell: ShellLine,
};

export type CommandChain = Command & {
  then?: CommandChainThen,
};

export type CommandChainThen = {
  type: '|&' | '|',
  chain: CommandChain,
};

export type CommandLine = {
  chain: CommandChain,
  then?: CommandLineThen,
};

export type CommandLineThen = {
  type: '&&' | '||',
  line: CommandLine,
};

export type ShellLine = Array<CommandLine>;

export declare const parse: (code: string) => ShellLine;
