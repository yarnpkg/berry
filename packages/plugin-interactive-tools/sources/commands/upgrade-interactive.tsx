import {BaseCommand, WorkspaceRequiredError}                                                                                            from '@yarnpkg/cli';
import {Cache, Configuration, Project, HardDependencies, formatUtils, miscUtils, structUtils, Descriptor, DescriptorHash, StreamReport} from '@yarnpkg/core';
import {ItemOptions}                                                                                                                    from '@yarnpkg/libui/sources/components/ItemOptions';
import {Pad}                                                                                                                            from '@yarnpkg/libui/sources/components/Pad';
import {ScrollableItems}                                                                                                                from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                                                                                                                   from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent}                                                                                            from '@yarnpkg/libui/sources/misc/renderForm';
import {suggestUtils}                                                                                                                   from '@yarnpkg/plugin-essentials';
import {Command, Usage}                                                                                                                 from 'clipanion';
import {diffWords}                                                                                                                      from 'diff';
import {Box, Text}                                                                                                                      from 'ink';
import React, {useEffect, useRef, useState}                                                                                             from 'react';
import semver                                                                                                                           from 'semver';

const SIMPLE_SEMVER = /^((?:[\^~]|>=?)?)([0-9]+)(\.[0-9]+)(\.[0-9]+)((?:-\S+)?)$/;
const DEFAULT_WINDOW_SIZE = 10;

type UpgradeSuggestion = {value: string | null, label: string};
type UpgradeSuggestions = Array<UpgradeSuggestion>;

// eslint-disable-next-line arca/no-default-export
export default class UpgradeInteractiveCommand extends BaseCommand {
  static paths = [
    [`upgrade-interactive`],
  ];

  static usage: Usage = Command.Usage({
    category: `Interactive commands`,
    description: `open the upgrade interface`,
    details: `
      This command opens a fullscreen terminal interface where you can see any out of date packages used by your application, their status compared to the latest versions available on the remote registry, and select packages to upgrade.
    `,
    examples: [[
      `Open the upgrade window`,
      `yarn upgrade-interactive`,
    ]],
  });

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
          str += formatUtils.pretty(configuration, part.value, `green`);
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

          res += formatUtils.pretty(configuration, matchedTo[t], color);
        } else {
          res += matchedTo[t];
        }
      }

      return res;
    };

    const fetchUpdatedDescriptor = async (descriptor: Descriptor, copyStyle: string, range: string) => {
      const candidate = await suggestUtils.fetchDescriptorFrom(descriptor, range, {project, cache, preserveModifier: copyStyle, workspace});

      if (candidate !== null) {
        return candidate.range;
      } else {
        return descriptor.range;
      }
    };

    const fetchSuggestions = async (descriptor: Descriptor): Promise<UpgradeSuggestions> => {
      const referenceRange = semver.valid(descriptor.range)
        ? `^${descriptor.range}`
        : descriptor.range;

      const [resolution, latest] = await Promise.all([
        fetchUpdatedDescriptor(descriptor, descriptor.range, referenceRange).catch(() => null),
        fetchUpdatedDescriptor(descriptor, descriptor.range, `latest`).catch(() => null),
      ]);

      const suggestions: Array<{value: string | null, label: string}> = [{
        value: null,
        label: descriptor.range,
      }];

      if (resolution && resolution !== descriptor.range) {
        suggestions.push({
          value: resolution,
          label: colorizeVersionDiff(descriptor.range, resolution),
        });
      } else {
        suggestions.push({value: null, label: ``});
      }

      if (latest && latest !== resolution && latest !== descriptor.range) {
        suggestions.push({
          value: latest,
          label: colorizeVersionDiff(descriptor.range, latest),
        });
      } else {
        suggestions.push({value: null, label: ``});
      }

      return suggestions;
    };

    const Prompt = () => {
      return (
        <Box flexDirection="row">
          <Box flexDirection="column" width={49}>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color="cyanBright">{`<up>`}</Text>/<Text bold color="cyanBright">{`<down>`}</Text> to select packages.
              </Text>
            </Box>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color="cyanBright">{`<left>`}</Text>/<Text bold color="cyanBright">{`<right>`}</Text> to select versions.
              </Text>
            </Box>
          </Box>
          <Box flexDirection="column">
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color="cyanBright">{`<enter>`}</Text> to install.
              </Text>
            </Box>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color="cyanBright">{`<ctrl+c>`}</Text> to abort.
              </Text>
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
              <Text color="greenBright">?</Text> Pick the packages you want to upgrade.
            </Text>
          </Box>
          <Box width={17}><Text bold underline color="gray">Current</Text></Box>
          <Box width={17}><Text bold underline color="gray">Range</Text></Box>
          <Box width={17}><Text bold underline color="gray">Latest</Text></Box>
        </Box>
      );
    };

    const UpgradeEntry = ({active, descriptor, suggestions}: {active: boolean, descriptor: Descriptor, suggestions: Array<UpgradeSuggestion>}) => {
      const [action, setAction] = useMinistore<string | null>(descriptor.descriptorHash, null);

      const packageIdentifier = structUtils.stringifyIdent(descriptor);
      const padLength = Math.max(0, 45 - packageIdentifier.length);
      return <>
        <Box>
          <Box width={45}>
            <Text bold>
              {structUtils.prettyIdent(configuration, descriptor)}
            </Text>
            <Pad active={active} length={padLength}/>
          </Box>
          {suggestions !== null
            ? <ItemOptions active={active} options={suggestions} value={action} skewer={true} onChange={setAction} sizes={[17, 17, 17]} />
            : <Box marginLeft={2}><Text color="gray">Fetching suggestions...</Text></Box>
          }
        </Box>
      </>;
    };

    const UpgradeEntries = ({dependencies}: { dependencies: Array<Descriptor> }) => {
      const [suggestions, setSuggestions] = useState<Array<readonly [Descriptor, UpgradeSuggestions]>|null>(null);
      const mountedRef = useRef<boolean>(true);

      useEffect(() => {
        return () => {
          mountedRef.current = false;
        };
      });

      useEffect(() => {
        Promise.all(dependencies.map(descriptor => fetchSuggestions(descriptor)))
          .then(allSuggestions => {
            const mappedToSuggestions = dependencies.map((descriptor, i) => {
              const suggestionsForDescriptor = allSuggestions[i];
              return [descriptor, suggestionsForDescriptor] as const;
            }).filter(([_, suggestions]) => suggestions.length > 1);

            if (mountedRef.current) {
              setSuggestions(mappedToSuggestions);
            }
          });
      }, []);

      // Still fetching
      if (!suggestions)
        return <Text>Fetching suggestions...</Text>;

      if (!suggestions.length)
        return <Text>No upgrades found</Text>;

      return <ScrollableItems radius={DEFAULT_WINDOW_SIZE} children={suggestions.map(([descriptor, upgrades]) => {
        return <UpgradeEntry key={descriptor.descriptorHash} active={false} descriptor={descriptor} suggestions={upgrades} />;
      })} />;
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

      return <Box flexDirection={`column`}>
        <Prompt/>
        <Header/>
        <UpgradeEntries dependencies={sortedDependencies} />
      </Box>;
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
