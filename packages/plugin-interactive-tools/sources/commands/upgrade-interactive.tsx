import {BaseCommand, WorkspaceRequiredError}                                                                               from '@yarnpkg/cli';
import {Cache, Configuration, Project, HardDependencies, miscUtils, structUtils, Descriptor, DescriptorHash, StreamReport} from '@yarnpkg/core';
import {ItemOptions}                                                                                                       from '@yarnpkg/libui/sources/components/ItemOptions';
import {ScrollableItems}                                                                                                   from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                                                                                                      from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent}                                                                               from '@yarnpkg/libui/sources/misc/renderForm';
import {suggestUtils}                                                                                                      from '@yarnpkg/plugin-essentials';
import {Command, Usage}                                                                                                    from 'clipanion';
import {diffWords}                                                                                                         from 'diff';
import {Box, Color, Text}                                                                                                  from 'ink';
import React, {useEffect, useState, useRef}                                                                                from 'react';
import semver                                                                                                              from 'semver';

const SIMPLE_SEMVER = /^((?:[\^~]|>=?)?)([0-9]+)(\.[0-9]+)(\.[0-9]+)((?:-\S+)?)$/;

// eslint-disable-next-line arca/no-default-export
export default class UpgradeInteractiveCommand extends BaseCommand {
  static usage: Usage = Command.Usage({
    category: `Interactive commands`,
    description: `open the upgrade interface`,
    details: `
      This command opens a fullscreen terminal interface where you can see the packages used by your application, their status compared to the latest versions available on the remote registry, and let you upgrade.
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
        if (color !== null || matchedFrom[t] !== matchedTo[t]) {
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
      const candidate = await suggestUtils.fetchDescriptorFrom(descriptor, range, {project, cache, preserveModifier: copyStyle});

      if (candidate !== null) {
        return candidate.range;
      } else {
        return descriptor.range;
      }
    };

    const fetchSuggestions = async (descriptor: Descriptor) => {
      const referenceRange = semver.valid(descriptor.range)
        ? `^${descriptor.range}`
        : descriptor.range;

      const [resolution, dependency] = await Promise.all([
        fetchUpdatedDescriptor(descriptor, descriptor.range, referenceRange),
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

      if (dependency !== resolution && dependency !== descriptor.range) {
        suggestions.push({
          value: dependency,
          label: colorizeVersionDiff(descriptor.range, dependency),
        });
      }

      return suggestions;
    };

    const Prompt = () => {
      return (
        <Box flexDirection="row">
          <Box flexDirection="column" width={49}>
            <Box marginLeft={1}>
             Press <Color bold cyanBright>{`<up>`}</Color>/<Color bold cyanBright>{`<down>`}</Color> to select packages.
            </Box>
            <Box marginLeft={1}>
             Press <Color bold cyanBright>{`<left>`}</Color>/<Color bold cyanBright>{`<right>`}</Color> to select versions.
            </Box>
          </Box>
          <Box flexDirection="column">
            <Box marginLeft={1}>
             Press <Color bold cyanBright>{`<enter>`}</Color> to install.
            </Box>
            <Box marginLeft={1}>
             Press <Color bold cyanBright>{`<ctrl+c>`}</Color> to abort.
            </Box>
          </Box>
        </Box>
      );
    };

    const Header = () => {
      return (
        <Box flexDirection="row" paddingTop={1} paddingBottom={1}>
          <Box width={50}>
            <Text bold>
              <Color greenBright>?</Color> Pick the packages you want to upgrade.
            </Text>
          </Box>
          <Box width={17}><Color bold underline gray>Current</Color></Box>
          <Box width={17}><Color bold underline gray>Range/Latest</Color></Box>
        </Box>
      );
    };

    const UpgradeEntry = ({active, descriptor}: {active: boolean, descriptor: Descriptor}) => {
      const [action, setAction] = useMinistore<string | null>(descriptor.descriptorHash, null);
      const [suggestions, setSuggestions] = useState<Array<{value: string | null, label: string}> | null>(null);

      const mountedRef = useRef<boolean>(true);

      useEffect(() => {
        return () => {
          mountedRef.current = false;
        };
      }, []);

      useEffect(() => {
        fetchSuggestions(descriptor).then(suggestions => {
          if (mountedRef.current) {
            setSuggestions(suggestions);
          }
        });
      }, [
        descriptor.descriptorHash,
      ]);

      return <Box>
        <Box width={45} textWrap="wrap">
          <Text bold>
            {structUtils.prettyIdent(configuration, descriptor)}
          </Text>
        </Box>
        {suggestions !== null
          ? <ItemOptions active={active} options={suggestions} value={action} onChange={setAction} sizes={[17, 17, 17]} />
          : <Box marginLeft={2}><Color gray>Fetching suggestions...</Color></Box>
        }
      </Box>;
    };

    const GlobalListApp: SubmitInjectedComponent<Map<string, string | null>> = ({useSubmit}) => {
      useSubmit(useMinistore());

      const allDependencies = new Map<DescriptorHash, Descriptor>();

      for (const workspace of project.workspaces)
        for (const dependencyType of [`dependencies`, `devDependencies`] as Array<HardDependencies>)
          for (const descriptor of workspace.manifest[dependencyType].values())
            if (project.tryWorkspaceByDescriptor(descriptor) === null)
              allDependencies.set(descriptor.descriptorHash, descriptor);

      const sortedDependencies = miscUtils.sortMap(allDependencies.values(), descriptor => {
        return structUtils.stringifyDescriptor(descriptor);
      });

      return <>
        <Box flexDirection={`column`}>
          <Prompt/>
          <Header/>
          <ScrollableItems radius={10} children={sortedDependencies.map(descriptor => {
            return <UpgradeEntry key={descriptor.descriptorHash} active={false} descriptor={descriptor} />;
          })} />
        </Box>
      </>;
    };

    const updateRequests = await renderForm(GlobalListApp, {});
    if (typeof updateRequests === `undefined`)
      return 1;

    let hasChanged = false;

    for (const workspace of project.workspaces) {
      for (const dependencyType of [`dependencies`, `devDependencies`] as Array<HardDependencies>) {
        const dependencies = workspace.manifest[dependencyType];

        for (const descriptor of dependencies.values()) {
          const newRange = updateRequests.get(descriptor.descriptorHash);

          if (typeof newRange !== `undefined` && newRange !== null) {
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
