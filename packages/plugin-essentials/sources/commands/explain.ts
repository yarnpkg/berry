import {BaseCommand}                                                                                                                   from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, formatUtils, YarnVersion, httpUtils, treeUtils, parseMessageName, stringifyMessageName} from '@yarnpkg/core';
import {Option, Command}                                                                                                               from 'clipanion';
import * as t                                                                                                                          from 'typanion';

import {resolveTag}                                                                                                                    from './set/version';

function getCodeName(code: string): string {
  return MessageName[parseMessageName(code)];
}

const ERROR_CODE_DOC_REGEXP = /## (?<code>YN[0-9]{4}) - `(?<name>[A-Z_]+)`\n\n(?<details>(?:.(?!##))+)/gs;

export async function getErrorCodeDetails(configuration: Configuration) {
  const version = miscUtils.isTaggedYarnVersion(YarnVersion)
    ? YarnVersion
    : await resolveTag(configuration, `canary`);

  const errorCodesUrl = `https://repo.yarnpkg.com/${version}/packages/gatsby/content/advanced/error-codes.md`;
  const raw: Buffer = await httpUtils.get(errorCodesUrl, {configuration});

  return new Map<string, string>(Array.from(raw.toString().matchAll(ERROR_CODE_DOC_REGEXP), ({groups}) => {
    if (!groups)
      throw new Error(`Assertion failed: Expected the match to have been successful`);

    const expectedName = getCodeName(groups.code);
    if (groups.name !== expectedName)
      throw new Error(`Assertion failed: Invalid error code data: Expected "${groups.name}" to be named "${expectedName}"`);

    return [groups.code, groups.details];
  }));
}

// eslint-disable-next-line arca/no-default-export
export default class ExplainCommand extends BaseCommand {
  static paths = [
    [`explain`],
  ];

  static usage = Command.Usage({
    description: `explain an error code`,
    details: `
      When the code argument is specified, this command prints its name and its details.

      When used without arguments, this command lists all error codes and their names.
    `,
    examples: [[
      `Explain an error code`,
      `$0 explain YN0006`,
    ], [
      `List all error codes`,
      `$0 explain`,
    ]],
  });

  code = Option.String({
    required: false,
    validator: t.applyCascade(t.isString(), [
      t.matchesRegExp(/^YN[0-9]{4}$/),
    ]),
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    if (typeof this.code !== `undefined`) {
      const name = getCodeName(this.code);

      const prettyName = formatUtils.pretty(configuration, name, formatUtils.Type.CODE);
      const header = this.cli.format().header(`${this.code} - ${prettyName}`);

      const errorCodeDetails = await getErrorCodeDetails(configuration);
      const details = errorCodeDetails.get(this.code);

      const content = typeof details !== `undefined`
        ? formatUtils.jsonOrPretty(this.json, configuration, formatUtils.tuple(
          formatUtils.Type.MARKDOWN,
          {
            text: details,
            format: this.cli.format(),
            paragraphs: true,
          },
        ))
        : `This error code does not have a description.\n\nYou can help us by editing this page on GitHub 🙂:\n${
          formatUtils.jsonOrPretty(this.json, configuration, formatUtils.tuple(
            formatUtils.Type.URL,
            `https://github.com/yarnpkg/berry/blob/master/packages/gatsby/content/advanced/error-codes.md`,
          ))
        }\n`;

      if (this.json) {
        this.context.stdout.write(`${JSON.stringify({code: this.code, name, details: content})}\n`);
      } else {
        this.context.stdout.write(`${header}\n\n${content}\n`);
      }
    } else {
      const tree: treeUtils.TreeNode = {
        children: miscUtils.mapAndFilter(Object.entries(MessageName), ([key, value]) => {
          if (Number.isNaN(Number(key)))
            return miscUtils.mapAndFilter.skip;

          return {
            label: stringifyMessageName(Number(key)),
            value: formatUtils.tuple(formatUtils.Type.CODE, value as string),
          };
        }),
      };

      treeUtils.emitTree(tree, {configuration, stdout: this.context.stdout, json: this.json});
    }
  }
}
