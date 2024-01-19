import {BaseCommand, WorkspaceRequiredError}  from '@yarnpkg/cli';
import {Configuration, Project, StreamReport} from '@yarnpkg/core';
import {miscUtils}                            from '@yarnpkg/core';
import {Option}                               from 'clipanion';
import {inspect}                              from 'util';

// eslint-disable-next-line arca/no-default-export
export default class RunIndexCommand extends BaseCommand {
  static paths = [
    [`run`],
  ];

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
    }, async report => {
      const scripts = workspace!.manifest.scripts;
      const keys = miscUtils.sortMap(scripts.keys(), key => key);
      const inspectConfig = {
        breakLength: Infinity,
        colors: configuration.get(`enableColors`),
        maxArrayLength: 2,
      };

      const maxKeyLength = keys.reduce((max, key) => {
        return Math.max(max, key.length);
      }, 0);

      for (const [key, script] of scripts.entries()) {
        report.reportInfo(null, `${key.padEnd(maxKeyLength, ` `)}   ${inspect(script, inspectConfig)}`);
        report.reportJson({name: key, script});
      }
    });

    return report.exitCode();
  }
}
