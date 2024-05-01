import {Argument, ArgumentSegment, ArithmeticExpression, Command, CommandChain, CommandChainThen, CommandLine, CommandLineThen, EnvSegment, parse, RedirectArgument, ShellLine, ValueArgument} from './grammars/shell';

export function parseShell(source: string, options: {isGlobPattern: (arg: string) => boolean} = {isGlobPattern: () => false}): ShellLine {
  try {
    return parse(source, options);
  } catch (error) {
    if (error.location)
      error.message = error.message.replace(/(\.)?$/, ` (line ${error.location.start.line}, column ${error.location.start.column})$1`);
    throw error;
  }
}

export function stringifyShellLine(shellLine: ShellLine, {endSemicolon = false}: {endSemicolon?: boolean} = {}): string {
  return shellLine
    .map(({command, type}, index) => `${
      stringifyCommandLine(command)
    }${
      type === `;`
        ? (index !== shellLine.length - 1 || endSemicolon ? `;` : ``)
        : ` &`
    }`)
    .join(` `);
}

export function stringifyCommandLine(commandLine: CommandLine): string {
  return `${stringifyCommandChain(commandLine.chain)}${commandLine.then ? ` ${stringifyCommandLineThen(commandLine.then)}` : ``}`;
}

export function stringifyCommandLineThen(commandLineThen: CommandLineThen): string {
  return `${commandLineThen.type} ${stringifyCommandLine(commandLineThen.line)}`;
}

export function stringifyCommandChain(commandChain: CommandChain): string {
  return `${stringifyCommand(commandChain)}${commandChain.then ? ` ${stringifyCommandChainThen(commandChain.then)}` : ``}`;
}

export function stringifyCommandChainThen(commandChainThen: CommandChainThen): string {
  return `${commandChainThen.type} ${stringifyCommandChain(commandChainThen.chain)}`;
}

export function stringifyCommand(command: Command): string {
  switch (command.type) {
    case `command`:
      return `${command.envs.length > 0 ? `${command.envs.map(env => stringifyEnvSegment(env)).join(` `)} ` : ``}${command.args.map(argument => stringifyArgument(argument)).join(` `)}`;

    case `subshell`:
      return `(${stringifyShellLine(command.subshell)})${command.args.length > 0 ? ` ${command.args.map(argument => stringifyRedirectArgument(argument)).join(` `)}` : ``}`;

    case `group`:
      return `{ ${stringifyShellLine(command.group, {/* Bash compat */ endSemicolon: true})} }${command.args.length > 0 ? ` ${command.args.map(argument => stringifyRedirectArgument(argument)).join(` `)}` : ``}`;

    case `envs`:
      return command.envs.map(env => stringifyEnvSegment(env)).join(` `);

    default:
      throw new Error(`Unsupported command type:  "${(command as any).type}"`);
  }
}

export function stringifyEnvSegment(envSegment: EnvSegment): string {
  return `${envSegment.name}=${envSegment.args[0] ? stringifyValueArgument(envSegment.args[0]) : ``}`;
}

export function stringifyArgument(argument: Argument): string {
  switch (argument.type) {
    case `redirection`:
      return stringifyRedirectArgument(argument);

    case `argument`:
      return stringifyValueArgument(argument);

    default:
      throw new Error(`Unsupported argument type: "${(argument as any).type}"`);
  }
}

export function stringifyRedirectArgument(argument: RedirectArgument): string {
  return `${argument.subtype} ${argument.args.map(argument => stringifyValueArgument(argument)).join(` `)}`;
}

export function stringifyValueArgument(argument: ValueArgument): string {
  return argument.segments.map(segment => stringifyArgumentSegment(segment)).join(``);
}

const ESCAPED_CONTROL_CHARS = new Map([
  [`\f`, `\\f`],
  [`\n`, `\\n`],
  [`\r`, `\\r`],
  [`\t`, `\\t`],
  [`\v`, `\\v`],
  [`\0`, `\\0`],
]);

const ESCAPED_DBL_CHARS = new Map([
  [`\\`, `\\\\`],
  [`$`, `\\$`],
  [`"`, `\\"`],
  ...Array.from(ESCAPED_CONTROL_CHARS, ([c, replacement]): [string, string] => {
    return [c, `"$'${replacement}'"`];
  }),
]);

const getEscapedControlChar = (c: string) => {
  return ESCAPED_CONTROL_CHARS.get(c) ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, `0`)}`;
};

const getEscapedDblChar = (match: string) => {
  return ESCAPED_DBL_CHARS.get(match) ?? `"$'${getEscapedControlChar(match)}'"`;
};

export function stringifyArgumentSegment(argumentSegment: ArgumentSegment): string {
  const doubleQuoteIfRequested = (string: string, quote: boolean) => quote
    ? `"${string}"`
    : string;

  const quoteIfNeeded = (text: string) => {
    if (text === ``)
      return `''`;

    if (!text.match(/[()}<>$|&;"'\n\t ]/))
      return text;

    if (!text.match(/['\t\p{C}]/u))
      return `'${text}'`;

    if (!text.match(/'/)) {
      return `$'${text.replace(/[\t\p{C}]/u, getEscapedControlChar)}'`;
    } else {
      return `"${text.replace(/["$\t\p{C}]/u, getEscapedDblChar)}"`;
    }
  };

  switch (argumentSegment.type) {
    case `text`:
      return quoteIfNeeded(argumentSegment.text);

    case `glob`:
      return argumentSegment.pattern;

    case `shell`:
      return doubleQuoteIfRequested(`$(${stringifyShellLine(argumentSegment.shell)})`, argumentSegment.quoted);

    case `variable`:
      return doubleQuoteIfRequested(
        typeof argumentSegment.defaultValue === `undefined`
          ? typeof argumentSegment.alternativeValue === `undefined`
            ? `\${${argumentSegment.name}}`
            : argumentSegment.alternativeValue.length === 0
              ? `\${${argumentSegment.name}:+}`
              : `\${${argumentSegment.name}:+${argumentSegment.alternativeValue.map(argument => stringifyValueArgument(argument)).join(` `)}}`
          : argumentSegment.defaultValue.length === 0
            ? `\${${argumentSegment.name}:-}`
            : `\${${argumentSegment.name}:-${argumentSegment.defaultValue.map(argument => stringifyValueArgument(argument)).join(` `)}}`,
        argumentSegment.quoted,
      );

    case `arithmetic`:
      return `$(( ${stringifyArithmeticExpression(argumentSegment.arithmetic)} ))`;

    default:
      throw new Error(`Unsupported argument segment type: "${(argumentSegment as any).type}"`);
  }
}

export function stringifyArithmeticExpression(argument: ArithmeticExpression): string {
  const getOperator = (type: ArithmeticExpression['type']) => {
    switch (type) {
      case `addition`:
        return `+`;
      case `subtraction`:
        return `-`;
      case `multiplication`:
        return `*`;
      case `division`:
        return `/`;
      default:
        throw new Error(`Can't extract operator from arithmetic expression of type "${type}"`);
    }
  };

  const parenthesizeIfRequested = (string: string, parenthesize: boolean) => parenthesize ? `( ${string} )` : string;
  const stringifyAndParenthesizeIfNeeded = (expression: ArithmeticExpression) =>
    // Right now we parenthesize all arithmetic operator expressions because it's easier
    parenthesizeIfRequested(stringifyArithmeticExpression(expression), ![`number`, `variable`].includes(expression.type));

  switch (argument.type) {
    case `number`:
      return String(argument.value);

    case `variable`:
      return argument.name;

    default:
      return `${stringifyAndParenthesizeIfNeeded(argument.left)} ${getOperator(argument.type)} ${stringifyAndParenthesizeIfNeeded(argument.right)}`;
  }
}

// For symmetry
export {stringifyShellLine as stringifyShell};
