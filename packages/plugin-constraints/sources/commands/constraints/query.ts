import {BaseCommand}            from '@yarnpkg/cli';
import {Configuration, Project} from '@yarnpkg/core';
import {StreamReport}           from '@yarnpkg/core';
import {Command, Option, Usage} from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class ConstraintsQueryCommand extends BaseCommand {
  static paths = [
    [`constraints`, `query`],
  ];

  static usage: Usage = Command.Usage({
    category: `Constraints-related commands`,
    description: `query the constraints fact database`,
    details: `
      This command will output all matches to the given prolog query.
    `,
    examples: [[
      `List all dependencies throughout the workspace`,
      `yarn constraints query 'workspace_has_dependency(_, DependencyName, _, _).'`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  query = Option.String();

  async execute() {
    const {Constraints} = await import(`../../Constraints`);

    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const constraints = await Constraints.find(project);

    const report = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const segments = this.query.split(`|`);
      const session = await constraints.createSession();

      let results: Array<Array<[string, string | null]>> = [[]];

      for (const segment of segments) {
        const contexts = await Promise.all(results);
        const next: Array<Promise<Array<Array<[string, string | null]>>>> = [];

        for (const context of contexts) {
          next.push(Promise.resolve().then(async () => {
            const results: Array<Array<[string, string | null]>> = [];

            for await (const result of constraints.query(segment, {context, session}))
              results.push(Object.entries(result));

            return results;
          }));
        }

        results = (await Promise.all(next)).flat();
      }

      for (const entries of await Promise.all(results)) {
        // We're not really supposed to do things differently depending on
        // whether we are in JSON mode or not, but given that this is inside
        // a tight loop, it doesn't cost a lot to avoid extra computations.

        if (!this.json) {
          const lineCount = entries.length;
          const maxVariableNameLength = entries.reduce((max, [variableName]) => Math.max(max, variableName.length), 0);

          for (let i = 0; i < lineCount; i++) {
            const [variableName, value] = entries[i];
            report.reportInfo(null, `${getLinePrefix(i, lineCount)}${variableName.padEnd(maxVariableNameLength, ` `)} = ${valueToString(value)}`);
          }
        }

        if (this.json) {
          const record = Object.fromEntries(entries);
          report.reportJson(record);
        }
      }
    });

    return report.exitCode();
  }
}

function valueToString(value: string | null): string {
  if (typeof value !== `string`)
    return `${value}`;

  if (value.match(/^[a-zA-Z][a-zA-Z0-9_]+$/))
    return value;

  return `'${value}'`;
}

function getLinePrefix(index: number, count: number): string {
  const isFirst = index === 0;
  const isLast = index === count - 1;

  if (isFirst && isLast)
    return ``;

  if (isFirst)
    return `┌ `;
  if (isLast)
    return `└ `;

  return `│ `;
}
