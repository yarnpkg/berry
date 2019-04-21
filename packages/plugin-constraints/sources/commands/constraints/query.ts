import {Configuration, Project, PluginConfiguration} from '@berry/core';
import {MessageName, StreamReport}                   from '@berry/core';
import {Writable}                                    from 'stream';

import {Constraints}                                 from '../../Constraints';

function valueToString(value: string|null): string {
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

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`constraints query <query>`)

  .categorize(`Constraints-related commands`)
  .describe(`query the constraints`)

  .detail(`
    This command will output all matches to the given prolog query
  `)

  .example(
    `List all dependencies throughout the workspace`,
    `yarn constraints query 'workspace_has_dependency(_, DependencyName, _, _).'`,
  )

  .action(async ({cwd, stdout, query}: {cwd: string, stdout: Writable, query: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const constraints = await Constraints.find(project);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      for await (const result of constraints.query(query)) {
        const lines = Array.from(Object.entries(result));
        const lineCount = lines.length;

        const maxVariableNameLength = lines.reduce((max, [variableName]) => Math.max(max, variableName.length), 0);

        for (let i = 0; i < lineCount; i++) {
          const [variableName, value] = lines[i];
          report.reportInfo(MessageName.UNNAMED, `${getLinePrefix(i, lineCount)}${variableName.padEnd(maxVariableNameLength, ` `)} = ${valueToString(value)}`);
        }
      }
    });

    return report.exitCode();
  });
