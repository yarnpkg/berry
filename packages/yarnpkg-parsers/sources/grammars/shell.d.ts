// From the top to the bottom:
//
// - A shell line is composed of multiple command lines, first separated by ";" and then chained by "&&" / "||"
// - A command line is composed of multiple commands chained by "|" / "|&"
// - A command is composed of multiple arguments separated by spaces
// - An argument can be a value argument (sent to the underlying program), or a redirection
// - A value argument is a combination of argument segments

export type ArgumentSegment =
  | {type: `text`, text: string}
  | {type: `glob`, pattern: string}
  | {type: `shell`, shell: ShellLine, quoted: boolean}
  | {type: `variable`, name: string, defaultValue?: Array<ValueArgument>, quoted: boolean};

export type Argument =
  | RedirectArgument
  | ValueArgument;

export type RedirectArgument =
  | {type: `redirection`, subtype: `>` | `<` | `>>` | `<<<`, args: Array<ValueArgument>};

export type ValueArgument =
  | {type: `argument`, segments: Array<ArgumentSegment>};

export type EnvSegment = {
  name: string,
  args: [] | [ValueArgument],
};

export type Command = {
  type: `command`,
  args: Array<Argument>,
  envs: Array<EnvSegment>,
} | {
  type: `subshell`,
  subshell: ShellLine,
  args: Array<RedirectArgument>,
} | {
  type: `envs`,
  envs: Array<EnvSegment>
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

export declare const parse: (code: string, options: {isGlobPattern: (arg: string) => boolean}) => ShellLine;
