import logger                                                                                                                              from '@docusaurus/logger';
import {type YarnCli, getCli}                                                                                                              from '@yarnpkg/cli';
import {parseShell, stringifyArgument, stringifyArgumentSegment, stringifyEnvSegment, type CommandChain, type CommandLine, type ShellLine} from '@yarnpkg/parsers';
import type {Token}                                                                                                                        from 'clipanion';
import {fromJs}                                                                                                                            from 'esast-util-from-js';
import {capitalize}                                                                                                                        from 'lodash';
import type {MdxJsxTextElement}                                                                                                            from 'mdast-util-mdx-jsx';
import type {Code, InlineCode, PhrasingContent, Root}                                                                                      from 'mdast';
import type {Transformer}                                                                                                                  from 'unified';
import {CONTINUE, SKIP, visit}                                                                                                             from 'unist-util-visit';

const NAMESPACE = `CommandLineHightlight`;

const otherCli: Record<string, Array<string> | undefined> = {
  node: [],
  corepack: [`enable`],
  npm: [`install`, `run`],
  git: [`checkout`, `reset`, `rev-parse`],
};

const placeholders = new Map<string, string | MdxJsxTextElement>();
const createPlaceholder = (raw: string, node?: MdxJsxTextElement) => {
  const key = Buffer.from(raw).toString(`base64`);
  placeholders.set(key, node ?? raw);
  return `__placeholder_${key}`;
};
const resolvePlaceholder = (text: string): {raw: string, node: string | MdxJsxTextElement}  => {
  const match = text.match(/^__placeholder_([a-zA-Z0-9+/=]+)$/);
  return match
    ? {raw: Buffer.from(match[1], `base64`).toString(), node: placeholders.get(match[1])!}
    : {raw: text, node: text};
};

const mdx = (name: string | null, attributes: Record<string, string> = {}, children: Array<string | MdxJsxTextElement> | string | MdxJsxTextElement = []): MdxJsxTextElement => {
  return {
    type: `mdxJsxTextElement`,
    name,
    attributes: Object.entries(attributes).map(([name, value]) => ({type: `mdxJsxAttribute`, name, value})),
    children: (Array.isArray(children) ? children : [children]).map(value => typeof value === `string` ? {type: `text`, value} : value),
  };
};

const makeBlock = (node: Code, cli: YarnCli): MdxJsxTextElement => {
  return mdx(`${NAMESPACE}.Block`, {}, node.value.trim().split(`\n`).map(line => {
    if (line.length === 0) {
      return mdx(`div`, {}, ` `);
    } else if (line.startsWith(`#`)) {
      return mdx(`${NAMESPACE}.BlockLine`, {}, [
        mdx(`${NAMESPACE}.Comment`, {}, line),
      ]);
    }

    const replaced = line.replaceAll(/<[^>]+>/g, match => createPlaceholder(match));
    try {
      return mdx(`${NAMESPACE}.BlockLine`, {}, makeShellLine(parseShell(replaced), cli));
    } catch {
      logger.warn`[CLH] Failed to parse block line: "${line}"`;
      return mdx(`div`, {}, line);
    }
  }));
};

const makeInline = (node: InlineCode, cli: YarnCli): PhrasingContent => {
  const line = node.value.trim();
  const replaced = line.replaceAll(/<[^>]+>/g, match => createPlaceholder(match));

  let parsed;
  try {
    parsed = parseShell(replaced)[0].command;
  } catch {
    logger.warn`[CLH] Failed to parse inline line: "${line}"`;
    return node;
  }

  return mdx(`${NAMESPACE}.Inline`, {}, makeCommandLine(parsed, cli));
};

const makeShellLine = (line: ShellLine, cli: YarnCli): MdxJsxTextElement => {
  const children = line.flatMap((chain, i) => [
    makeCommandLine(chain.command, cli),
    mdx(`span`, {}, (chain.type === `;` ? `;` : ` &`) + (i === line.length - 1 ? `` : ` `)),
  ]);

  if (line.at(-1)?.type === `;`)
    children.pop();

  return mdx(null, {}, children);
};

const makeCommandLine = (line: CommandLine, cli: YarnCli): MdxJsxTextElement => {
  const nodes = [];
  for (let command: CommandLine | undefined = line; command; command = command.then?.line) {
    for (let chain: CommandChain | undefined = command.chain; chain; chain = chain.then?.chain) {
      // TODO: Support more types?
      if (chain.type !== `command`)
        throw new Error(`Unsupported command type: "${chain.type}" when parsing "${line}"`);

      if (chain.envs.length > 0)
        nodes.push(mdx(`span`, {}, chain.envs.map(segment => `${stringifyEnvSegment(segment)} `).join(` `)));

      const args = chain.args.map(arg => {
        // TODO: Support more types?
        if (arg.type !== `argument`)
          throw new Error(`Unsupported argument type: "${arg.type}" when parsing "${line}"`);

        const segments = arg.segments.flatMap(segment => {
          if (segment.type === `shell`) {
            return [
              segment.quoted ? `"$(` : `$(`,
              makeShellLine(segment.shell, cli),
              segment.quoted ? `)"` : `)`,
            ];
          } else {
            return [stringifyArgumentSegment(segment)];
          }
        });

        if (segments.every(segment => typeof segment === `string`)) {
          return (segments as Array<string>).join(``);
        } else {
          return createPlaceholder(stringifyArgument(arg), mdx(`span`, {}, segments));
        }
      });

      nodes.push(args[0] === cli.binaryName ? makeYarnCommand(args, cli) : makeOtherCommand(args));

      if (chain.then) {
        nodes.push(mdx(`span`, {}, ` ${chain.then.type} `));
      }
    }

    if (command.then) {
      nodes.push(mdx(`span`, {}, ` ${command.then.type} `));
    }
  }

  return mdx(null, {}, nodes);
};

const makeYarnCommand = (args: Array<string>, cli: YarnCli): MdxJsxTextElement => {
  const [, ...argv] = args;

  // Define `yarn global` as an unknown command instead of implicit run
  if (argv.length === 1 && argv[0] === `global`) {
    return mdx(`${NAMESPACE}.Command`, {}, [
      mdx(`${NAMESPACE}.Binary`, {}, cli.binaryName),
      mdx(`${NAMESPACE}.Unknown`, {}, `global`),
    ]);
  }

  let command;
  try {
    command = cli.process({
      input: argv,
      context: cli.defaultContext,
      partial: true,
    });
  } catch {
    return mdx(`${NAMESPACE}.Command`, {}, [
      mdx(`${NAMESPACE}.Binary`, {}, cli.binaryName),
      mdx(`${NAMESPACE}.Unknown`, {}, argv.join(` `)),
    ]);
  }

  const definition = cli.definition(command.constructor);

  type RenderNode =
    | Exclude<Token, { type: `path` }>
    | {
      type: `path`;
      tokens: Array<Extract<Token, { type: `path` }>>;
    }
    | {
      type: `group`;
      tokens: Array<Exclude<Token, { type: `path` }>>;
    };

  const nodes: Array<RenderNode> = [];
  let last: RenderNode | null = null;
  for (const token of command.tokens) {
    if (token.type === `path`) {
      if (last?.type === `path`) {
        last.tokens.push(token);
      } else {
        nodes.push(last = {type: `path`, tokens: [token]});
      }
    } else if (token.slice) {
      if (last?.type === `group` && last.tokens[0].segmentIndex === token.segmentIndex) {
        last.tokens.push(token);
      } else {
        nodes.push(last = {type: `group`, tokens: [token]});
      }
    } else {
      nodes.push(last = token);
    }
  }

  const resolveText = (token: Token) => {
    return token.slice ? argv[token.segmentIndex].slice(...token.slice) : argv[token.segmentIndex];
  };

  const makeMdastNode = (node: RenderNode): MdxJsxTextElement => {
    if (node.type === `path`) {
      return mdx(
        `${NAMESPACE}.Path`,
        definition?.description ? {tooltip: capitalize(definition.description), href: `/cli/${command.path.join(`/`)}`} : {},
        node.tokens.map(resolveText).join(` `),
      );
    } else if (node.type === `group`) {
      return mdx(`span`, {}, node.tokens.map(makeMdastNode));
    } else if (node.type === `option`) {
      const option = definition?.options.find(option => option.preferredName === node.option);
      return mdx(
        `${NAMESPACE}.Option`,
        option?.description ? {tooltip: option.description} : {},
        node.option,
      );
    } else {
      return mdx(
        `${NAMESPACE}.${capitalize(node.type)}`,
        {},
        resolvePlaceholder(resolveText(node)).node,
      );
    }
  };

  return mdx(`${NAMESPACE}.Command`, {}, [
    mdx(`${NAMESPACE}.Binary`, {}, cli.binaryName),
    ...nodes.map(makeMdastNode),
  ]);
};

const makeOtherCommand = (args: Array<string>): MdxJsxTextElement => {
  const [name, ...argv] = args;
  const paths = otherCli[name];

  const getTokenType = (text: string) => {
    if (paths?.includes(text)) {
      return `Path`;
    } else if (text.match(/^--?\w/)) {
      return `Option`;
    } else {
      return `Positional`;
    }
  };

  return mdx(`${NAMESPACE}.Command`, {}, [
    mdx(`${NAMESPACE}.Binary`, {}, name),
    ...argv.map(arg => mdx(`${NAMESPACE}.${getTokenType(arg)}`, {}, resolvePlaceholder(arg).node)),
  ]);
};

const cliP = getCli();
export function plugin() {
  const transformer: Transformer<Root> = async ast => {
    const cli = await cliP;

    const knownCommands = [cli.binaryName, ...Object.keys(otherCli)];
    const commandRegex = new RegExp(`^([A-Z_]+=\\w*\\s+)?(${knownCommands.join(`|`)})( |$)`);

    let hasImport = ast.children.some(node => node.type === `mdxjsEsm` && node.value.includes(`* as ${NAMESPACE}`));
    function ensureImport() {
      if (!hasImport) {
        hasImport = true;

        const code = `import * as ${NAMESPACE} from '@site/src/components/CommandLineHighlight2.tsx';`;
        ast.children.unshift({
          type: `mdxjsEsm`,
          value: code,
          data: {estree: fromJs(code, {module: true})},
        });
      }
    }

    visit(ast, (node, index, parent) => {
      if (node.type === `code`) {
        if (node.lang === `commandline`) {
          parent!.children[index!] = makeBlock(node, cli);
          ensureImport();

          return SKIP;
        }

        const meta = node.meta?.split(` `).includes(`commandline`);
        if (meta) {
          parent!.children[index!] = makeBlock(node, cli);
          ensureImport();

          return SKIP;
        }
      } else if (node.type === `inlineCode` && !node.value.includes(`!`)) {
        const prev = index !== undefined ? parent!.children[index - 1] : undefined;
        const comment = prev?.type === `mdxTextExpression`
          ? prev.data?.estree?.comments?.find(comment => /^\s*commandline(\s|$)/.test(comment.value))?.value
          : undefined;
        const match = comment?.match(/^\s*commandline:(\{.+)/);

        if (comment || node.value.match(commandRegex)) {
          parent!.children[index!] = makeInline(node, cli);
          ensureImport();

          return SKIP;
        }
      }

      return CONTINUE;
    });
  };

  return transformer;
}
