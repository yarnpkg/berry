import {BaseCommand, WorkspaceRequiredError}                                                                               from '@yarnpkg/cli';
import {Cache, Configuration, Project, HardDependencies, miscUtils, structUtils, Descriptor, DescriptorHash, StreamReport} from '@yarnpkg/core';
import {ItemOptions}                                                                                                       from '@yarnpkg/libui/sources/components/ItemOptions';
import {ScrollableItems}                                                                                                   from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                                                                                                      from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm}                                                                                                        from '@yarnpkg/libui/sources/misc/renderForm';
import {suggestUtils}                                                                                                      from '@yarnpkg/plugin-essentials';
import {Command}                                                                                                           from 'clipanion';
import {diffWords}                                                                                                         from 'diff';
import {Box, Color}                                                                                                        from 'ink';
import React, {useEffect, useState}                                                                                        from 'react';

const SIMPLE_SEMVER = /^([\^~]?)([0-9+])(\.[0-9]+)(\.[0-9]+)((?:-\S+)?)$/;

// eslint-disable-next-line arca/no-default-export
export default class UpgradeInteractiveCommand extends BaseCommand {
  static usage = Command.Usage({
    category: `Interactive commands`,
    description: `open the upgrade interace`,
    details: `
      > In order to use this command you will need to add \`@yarnpkg/plugin-interactive-tools\` to your plugins. Check the documentation for \`yarn plugin import\` for more details.

      This command opens a fullscreen terminal interace where you can see the packages used by your application, their status compared to the latest versions available on the remote registry, and let you upgrade.
    `,
    examples: [[
      `Open the upgrade window`,
      `yarn upgrade-interactive`,
    ]],
  });

  @Command.Path(`upgrade-interactive`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const colorizeRawDiff = (from: string, to: string) => {
      const diff = diffWords(from, to);
      let str = ``;

      for (const part of diff) {
        if (part.added) {
          str += configuration.format(part.value, `green`);
        } else if (!part.removed) {
          str += part.value;
        }
      }

      return str;
    };

    const colorizeVersionDiff = (from: string, to: string) => {
      if (from === to)
        return to;

      const parsedFrom = structUtils.parseRange(from);
      const parsedTo = structUtils.parseRange(to);

      const matchedFrom = parsedFrom.selector.match(SIMPLE_SEMVER);
      const matchedTo = parsedTo.selector.match(SIMPLE_SEMVER);

      if (!matchedFrom || !matchedTo)
        return colorizeRawDiff(from, to);

      const SEMVER_COLORS = [
        `gray`, // modifier
        `red`, // major
        `yellow`, // minor
        `green`, // patch
        `magenta`, // rc
      ];

      let color: string | null = null;
      let res = ``;

      for (let t = 1; t < SEMVER_COLORS.length; ++t) {
        if (matchedFrom[t] !== matchedTo[t]) {
          if (color === null)
            color = SEMVER_COLORS[t - 1];

          res += configuration.format(matchedTo[t], color);
        } else {
          res += matchedTo[t];
        }
      }

      return res;
    };

    const fetchUpdatedDescriptor = async (descriptor: Descriptor, copyStyle: string, range: string) => {
      const candidate = await suggestUtils.fetchDescriptorFrom(descriptor, descriptor.range, {project, cache});

      if (candidate !== null) {
        return candidate.range;
      } else {
        return descriptor.range;
      }
    };

    const fetchSuggestions = async (descriptor: Descriptor) => {
      const [resolution, dependency] = await Promise.all([
        fetchUpdatedDescriptor(descriptor, descriptor.range, descriptor.range),
        fetchUpdatedDescriptor(descriptor, descriptor.range, `latest`),
      ]);

      const suggestions: Array<{value: string | null, label: string}> = [{
        value: null,
        label: descriptor.range,
      }];

      if (resolution !== descriptor.range) {
        suggestions.push({
          value: resolution,
          label: colorizeVersionDiff(descriptor.range, resolution),
        });
      }

      if (dependency !== resolution) {
        suggestions.push({
          value: dependency,
          label: colorizeVersionDiff(descriptor.range, dependency),
        });
      }

      return suggestions;
    };

    const UpgradeEntry = ({active, descriptor}: {active: boolean, descriptor: Descriptor}) => {
      const [action, setAction] = useMinistore<string | null>(descriptor.descriptorHash, null);
      const [suggestions, setSuggestions] = useState<Array<{value: string | null, label: string}> | null>(null);

      useEffect(() => {
        fetchSuggestions(descriptor).then(suggestions => {
          setSuggestions(suggestions);
        });
      }, [
        descriptor.descriptorHash,
      ]);

      return <Box>
        <Box width={60}>
          {structUtils.prettyIdent(configuration, descriptor)}
        </Box>
        {suggestions !== null
          ? <ItemOptions active={active} options={suggestions} value={action} onChange={setAction} sizes={[15, 15, 15]} />
          : <Box><Color gray>Fetching suggestions...</Color></Box>
        }
      </Box>;
    };

    const GlobalListApp = ({useSubmit}: any) => {
      useSubmit(useMinistore());

      const allDependencies = new Map<DescriptorHash, Descriptor>();

      for (const workspace of project.workspaces)
        for (const dependencyType of [`dependencies`, `devDependencies`] as Array<HardDependencies>)
          for (const descriptor of workspace.manifest[dependencyType].values())
            if (project.findWorkspacesByDescriptor(descriptor).length === 0)
              allDependencies.set(descriptor.descriptorHash, descriptor);

      const sortedDependencies = miscUtils.sortMap(allDependencies.values(), descriptor => {
        return structUtils.stringifyDescriptor(descriptor);
      });

      return <>
        <Box flexDirection={`column`}>
          <Box textWrap={`wrap`} marginBottom={1}>
            The following packages are direct dependencies of your project. Select those you want to upgrade, then press enter. Press ctrl-C to abort at any time:
          </Box>
          <ScrollableItems size={10} children={sortedDependencies.map(descriptor => {
            return <UpgradeEntry key={descriptor.descriptorHash} active={false} descriptor={descriptor} />;
          })} />
        </Box>
      </>;
    };

    const updateRequests = await renderForm<Map<DescriptorHash, string>>(GlobalListApp, {});
    if (typeof updateRequests === `undefined`)
      return 1;

    let hasChanged = false;

    for (const workspace of project.workspaces) {
      for (const dependencyType of [`dependencies`, `devDependencies`] as Array<HardDependencies>) {
        const dependencies = workspace.manifest[dependencyType];

        for (const descriptor of dependencies.values()) {
          const newRange = updateRequests.get(descriptor.descriptorHash);

          if (typeof newRange !== `undefined`) {
            dependencies.set(descriptor.identHash, structUtils.makeDescriptor(descriptor, newRange));
            hasChanged = true;
          }
        }
      }
    }

    if (!hasChanged)
      return 0;

    const installReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeLogs: !this.context.quiet,
    }, async report => {
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }
}
