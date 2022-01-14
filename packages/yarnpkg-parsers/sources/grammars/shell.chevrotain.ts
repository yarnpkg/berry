import * as chevrotain     from 'chevrotain';
import util                from 'util';

import {parse as parsePeg} from './shell';

export type ArgumentSegment =
  | {type: `text`, text: string}
  | {type: `glob`, pattern: string}
  | {type: `shell`, shell: ShellLine, quoted: boolean}
  | {type: `variable`, name: string, defaultValue?: Array<ValueArgument>, alternativeValue?: Array<ValueArgument>, quoted: boolean}
  | {type: `arithmetic`, arithmetic: ArithmeticExpression};

export type Argument =
  | RedirectArgument
  | ValueArgument;

export type RedirectArgument = {
  type: `redirection`;
  subtype: `>` | `<` | '>&' | '<&' | `>>` | `<<<`;
  fd: number | null;
  args: Array<ValueArgument>;
};

export type ValueArgument =
  | {type: `argument`, segments: Array<ArgumentSegment>};

export type EnvSegment = {
  name: string;
  args: [] | [ValueArgument];
};

export type Command = {
  type: `command`;
  args: Array<Argument>;
  envs: Array<EnvSegment>;
} | {
  type: `subshell`;
  subshell: ShellLine;
  args: Array<RedirectArgument>;
} | {
  type: `group`;
  group: ShellLine;
  args: Array<RedirectArgument>;
} | {
  type: `envs`;
  envs: Array<EnvSegment>;
};

export type CommandChain = Command & {
  then?: CommandChainThen;
};

export type CommandChainThen = {
  type: `|&` | `|`;
  chain: CommandChain;
};

export type CommandLine = {
  chain: CommandChain;
  then?: CommandLineThen;
};

export type CommandLineThen = {
  type: `&&` | `||`;
  line: CommandLine;
};

export type ShellLine = Array<{
  type: ';' | '&';
  command: CommandLine;
}>;

export type ArithmeticPrimary = {
  type: `number`;
  value: number;
} | {
  type: `variable`;
  name: string;
};

export type ArithmeticOperatorExpression = {
  type: `multiplication` | `division` | `addition` | `subtraction`;
  left: ArithmeticExpression;
  right: ArithmeticExpression;
};

export type ArithmeticExpression = ArithmeticPrimary | ArithmeticOperatorExpression;

export declare const parse: (code: string, options: {isGlobPattern: (arg: string) => boolean}) => ShellLine;

const createToken = chevrotain.createToken;
const tokenMatcher = chevrotain.tokenMatcher;
const Lexer = chevrotain.Lexer;
const EmbeddedActionsParser = chevrotain.EmbeddedActionsParser;

const parseShell = (command: string) => {
  const CommandLineType = createToken({name: `CommandLineType`, pattern: Lexer.NA});
  const And = createToken({name: `And`, pattern: /&&/, categories: CommandLineType});
  const Or = createToken({name: `Or`, pattern: /\|\|/, categories: CommandLineType});

  const CommandChainType = createToken({name: `CommandChainType`, pattern: Lexer.NA});
  const PipeAll = createToken({name: `PipeAll`, pattern: /\|&/, categories: CommandChainType});
  const Pipe = createToken({name: `Pipe`, pattern: /\|/, categories: CommandChainType});

  const ShellLineType = createToken({name: `ShellLineType`, pattern: Lexer.NA});
  const Sequence = createToken({name: `Sequence`, pattern: /;/, categories: ShellLineType});
  const Parallel = createToken({name: `Sequence`, pattern: /&/, categories: ShellLineType});

  const LParen = createToken({name: `LParen`, pattern: /\(/});
  const RParen = createToken({name: `RParen`, pattern: /\)/});

  const Argument = createToken({name: `Argument`, pattern: /[a-z]+/});

  const WhiteSpace = createToken({
    name: `WhiteSpace`,
    pattern: /\s+/,
    group: Lexer.SKIPPED,
  });

  const allTokens = [WhiteSpace, CommandLineType, And, Or, CommandChainType, PipeAll, Pipe, ShellLineType, Sequence, Parallel, LParen, RParen, Argument];
  const ShellLexer = new Lexer(allTokens);

  class ShellParser extends EmbeddedActionsParser {
    shellLine = this.RULE(`shellLine`, (): ShellLine => {
      const initial = this.SUBRULE(this.commandLine);

      const shellLine: ShellLine = [{
        command: initial,
        type: `;`,
      }];

      this.OPTION(() => {
        const typeToken = this.CONSUME(ShellLineType);
        shellLine[0].type = typeToken.image as any;

        this.OPTION1(() => {
          const rest = this.SUBRULE(this.shellLine);
          this.ACTION(() => {
            shellLine.push(...rest);
          });
        });
      });

      return shellLine;
    });

    commandLine = this.RULE(`commandLine`, (): CommandLine => {
      const initial = this.SUBRULE(this.commandChain);

      const commandLine: CommandLine = {
        chain: initial,
        then: undefined,
      };

      this.OPTION(() => {
        const typeToken = this.CONSUME(CommandLineType);
        const line = this.SUBRULE(this.commandLine);

        this.ACTION(() => {
          commandLine.then = {
            type: typeToken.image as any,
            line,
          };
        });
      });

      return commandLine;
    });

    commandChain = this.RULE(`commandChain`, (): CommandChain => {
      const command = this.SUBRULE(this.command);
      const commandChain: CommandChain = command;

      this.OPTION(() => {
        const typeToken = this.CONSUME(CommandChainType);
        const chain = this.SUBRULE(this.commandChain);

        this.ACTION(() => {
          commandChain.then = {
            type: typeToken.image as any,
            chain,
          };
        });
      });

      return commandChain;
    });

    command = this.RULE(`command`, (): Command => {
      const args: Array<Argument> = [];

      this.AT_LEAST_ONE(() => {
        const arg = this.SUBRULE(this.argument);

        this.ACTION(() => {
          args.push(arg);
        });
      });

      return {
        type: `command`,
        args,
        envs: [],
      };
    });

    argument = this.RULE(`argument`, (): Argument => {
      const {image} = this.CONSUME(Argument);
      return {type: `argument`, segments: [{type: `text`, text: image}]};
    });

    constructor() {
      super(allTokens);
      this.performSelfAnalysis();
    }
  }

  const parser = new ShellParser();

  const lexingResult = ShellLexer.tokenize(command);
  parser.input = lexingResult.tokens;

  return parser.shellLine();
};

{
  const start = Date.now();
  const res = parseShell(process.argv[2]);
  const end = Date.now();

  console.log(util.inspect(res, {depth: Infinity}), end - start);
}

{
  const start = Date.now();
  const res = parsePeg(process.argv[2], {isGlobPattern: () => false});
  const end = Date.now();

  console.log(util.inspect(res, {depth: Infinity}), end - start);
}
