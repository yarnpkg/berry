import {Configuration, Project, PluginConfiguration} from '@berry/core';
import {Writable}                                    from 'stream';

import {Constraints}                                 from '../../Constraints';

function valueToString(value: string|null): string {
  if (typeof value !== `string`)
    return `${value}`;

  if (value.match(/^[a-zA-Z][a-zA-Z0-9_]+$/))
    return value;

  return `'${value}'`;
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
    
    for await (const result of constraints.query(query)) {
      const stringifiedResult = Array.from(Object.entries(result), ([variable, value]) => `${variable} = ${valueToString(value)}`).join(`,\n`);

      stdout.write(`${stringifiedResult} ;\n`);
    }

    stdout.write(`false.\n`);
  });
