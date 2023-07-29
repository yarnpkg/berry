import {YarnCli, getCli}   from '@yarnpkg/cli';
import {parseShell}        from '@yarnpkg/parsers';
import {Definition, Token} from 'clipanion';
import {capitalize}        from 'lodash';
import visit               from 'unist-util-visit-parents';

export type ScriptLine =
  | RawLine
  | CommandLine;

export type RawLine = ReturnType<typeof makeRawLine>;
export type CommandLine = ReturnType<typeof makeCommandLine>;

export type CustomToken = Token | {
  segmentIndex: number;
  type: `dash`;
  slice: [number, number];
  option: string;
};

function getTokenText(token: CustomToken, argv: Array<string>) {
  const arg = argv[token.segmentIndex];
  return token.slice ? arg.slice(token.slice[0], token.slice[1]) : arg;
}

function getTokenTooltip(token: CustomToken, definition: Definition | null) {
  if (!definition)
    return null;

  if (token.type !== `option`)
    return null;

  const option = definition.options.find(option => option.preferredName === token.option);
  if (!option?.description)
    return null;

  return option.description;
}

const makeRawLine = (line: string) => ({
  type: `raw` as const,
  value: line,
});

const makeCommandLine = (line: string, cli: YarnCli) => {
  const parsed = parseShell(line)[0].command.chain;
  if (parsed.type !== `command`)
    throw new Error(`Unsupported command type: "${parsed.type}" when parsing "${line}"`);

  const strArgs = parsed.args.map((arg, index) => {
    if (arg.type !== `argument`)
      throw new Error(`Unsupported argument type: "${arg.type}" when parsing "${line}"`);

    if (arg.segments.length !== 1)
      throw new Error(`Unsupported argument segments length: "${arg.segments.length}" when parsing "${line}"`);

    const segment = arg.segments[0];
    if (segment.type !== `text`)
      throw new Error(`Unsupported argument segment type: "${segment.type}" when parsing "${line}"`);

    return segment.text;
  });

  const [name, ...argv] = strArgs;

  const splitPoint = argv.indexOf(`!`);

  if (splitPoint !== -1)
    argv.splice(splitPoint, 1);

  const command = cli.process({
    input: argv,
    context: cli.defaultContext,
    partial: true,
  });

  const tokens = command.tokens.flatMap((token): Array<CustomToken> => {
    if (token.segmentIndex < splitPoint)
      return [];

    if (token.type !== `option`)
      return [token];

    if (token.slice && token.slice[0] !== 0)
      return [token];

    const segment = argv[token.segmentIndex];
    const segmentLength = token.slice
      ? token.slice[1]
      : segment.length;

    const firstNonDashIndex = segment.search(/[^-]/);
    if (firstNonDashIndex === -1)
      return [token];

    return [{
      segmentIndex: token.segmentIndex,
      type: `dash`,
      slice: [0, firstNonDashIndex],
      option: token.option,
    }, {
      segmentIndex: token.segmentIndex,
      type: `option`,
      slice: [firstNonDashIndex, segmentLength],
      option: token.option,
    }];
  });

  const path = command.path;
  const definition = cli.definition(command.constructor);

  const tooltip = definition?.description
    ? capitalize(definition.description)
    : null;

  return {
    type: `command` as const,
    command: {name, path, argv},
    split: splitPoint !== -1,
    tooltip,
    tokens: tokens.map(token => ({
      ...token,
      text: getTokenText(token, argv),
      tooltip: getTokenTooltip(token, definition),
    })),
  };
};

const makeCommandOrRawLine = (line: string, cli: YarnCli) => {
  try {
    return makeCommandLine(line, cli);
  } catch {
    return makeRawLine(line);
  }
};

export const plugin = () => () => {
  const cliP = getCli();

  const transformer = async ast => {
    const cli = await cliP;

    const highlightNodes: Array<Promise<void>> = [];

    visit(ast, (node, ancestors) => {
      if (node.type !== `inlineCode` && (node.type !== `code` || node.lang))
        return;

      const lines = node.value.trim().split(`\n`).map(line => {
        if (line.startsWith(`#`) || line.length === 0) {
          return () => makeRawLine(line);
        } else if (line.startsWith(`${cli.binaryName} `)) {
          return () => makeCommandOrRawLine(line, cli);
        } else {
          return null;
        }
      });

      if (lines.some(line => line === null))
        return;

      const highlightNode = {
        type: `jsx`,
        value: ``,
      };

      const parent = ancestors[ancestors.length - 1];
      const index = parent.children.indexOf(node);

      parent.children[index] = highlightNode;

      highlightNodes.push(Promise.all(lines.map(line => line())).then(lines => {
        highlightNode.value = `<CommandLineHighlight type={${JSON.stringify(node.type)}} lines={${JSON.stringify(lines)}}/>`;
      }));
    });

    if (highlightNodes.length > 0) {
      ast.children.unshift({
        type: `import`,
        value: `import {CommandLineHighlight} from '@yarnpkg/docusaurus/src/components/CommandLineHighlight';\n`,
      });

      await Promise.all(highlightNodes);
    }
  };

  return transformer;
};
