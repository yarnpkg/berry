import {BaseCommand, WorkspaceRequiredError}                                                                                            from '@yarnpkg/cli';
import {Cache, Configuration, Project, HardDependencies, formatUtils, miscUtils, structUtils, Descriptor, DescriptorHash, StreamReport} from '@yarnpkg/core';
import {ItemOptions}                                                                                                                    from '@yarnpkg/libui/sources/components/ItemOptions';
import {Pad}                                                                                                                            from '@yarnpkg/libui/sources/components/Pad';
import {ScrollableItems}                                                                                                                from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                                                                                                                   from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent}                                                                                            from '@yarnpkg/libui/sources/misc/renderForm';
import {suggestUtils}                                                                                                                   from '@yarnpkg/plugin-essentials';
import {Command, Usage, UsageError}                                                                                                     from 'clipanion';
import {diffWords}                                                                                                                      from 'diff';
import {Box, Text}                                                                                                                      from 'ink';
import React, {useEffect, useRef, useState}                                                                                             from 'react';
import semver                                                                                                                           from 'semver';
import {WriteStream}                                                                                                                    from 'tty';

const SIMPLE_SEMVER = /^((?:[\^~]|>=?)?)([0-9]+)(\.[0-9]+)(\.[0-9]+)((?:-\S+)?)$/;

// eslint-disable-next-line @typescript-eslint/comma-dangle -- the trailing comma is required because of parsing ambiguities
const partition = <T,>(array: Array<T>, size: number): Array<Array<T>> => {
  return array.length > 0
    ? [array.slice(0, size)].concat(partition(array.slice(size), size))
    : [];
};

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
    if (!(this.context.stdout as WriteStream).isTTY)
      throw new UsageError(`This command can only be run in a TTY environment`);

    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState({
      restoreResolutions: false,
    });

    // 7 = 1-line command written by the user
    //   + 2-line prompt
    //   + 1 newline
    //   + 1-line header
    //   + 1 newline
    //     [...package list]
    //   + 1 empty line
    const VIEWPORT_SIZE = (this.context.stdout as WriteStream).rows - 7;

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
        <Box flexDirection={`row`}>
          <Box flexDirection={`column`} width={49}>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<up>`}</Text>/<Text bold color={`cyanBright`}>{`<down>`}</Text> to select packages.
              </Text>
            </Box>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<left>`}</Text>/<Text bold color={`cyanBright`}>{`<right>`}</Text> to select versions.
              </Text>
            </Box>
          </Box>
          <Box flexDirection={`column`}>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<enter>`}</Text> to install.
              </Text>
            </Box>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<ctrl+c>`}</Text> to abort.
              </Text>
            </Box>
          </Box>
        </Box>
      );
    };

    const Header = () => {
      return (
        <Box flexDirection={`row`} paddingTop={1} paddingBottom={1}>
          <Box width={50}>
            <Text bold>
              <Text color={`greenBright`}>?</Text> Pick the packages you want to upgrade.
            </Text>
          </Box>
          <Box width={17}><Text bold underline color={`gray`}>Current</Text></Box>
          <Box width={17}><Text bold underline color={`gray`}>Range</Text></Box>
          <Box width={17}><Text bold underline color={`gray`}>Latest</Text></Box>
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
          <ItemOptions active={active} options={suggestions} value={action} skewer={true} onChange={setAction} sizes={[17, 17, 17]} />
        </Box>
      </>;
    };

    const UpgradeEntries = ({dependencies}: {dependencies: Array<Descriptor>}) => {
      const [suggestions, setSuggestions] = useState<Array<{descriptor: Descriptor, suggestions: UpgradeSuggestions} | null>>(dependencies.map(() => null));
      const mountedRef = useRef<boolean>(true);

      const getSuggestionsForDescriptor = async (descriptor: Descriptor) => {
        const suggestions = await fetchSuggestions(descriptor);
        if (suggestions.filter(suggestion => suggestion.label !== ``).length <= 1)
          return null;

        return {descriptor, suggestions};
      };

      useEffect(() => {
        return () => {
          mountedRef.current = false;
        };
      }, []);

      useEffect(() => {
        // Updating the invisible suggestions as they resolve causes continuous lag spikes while scrolling through the list of visible suggestions.
        // Because of that, we update the invisible suggestions in batches of VIEWPORT_SIZE.

        const foregroundDependencyCount = Math.trunc(VIEWPORT_SIZE * 1.75);

        const foregroundDependencies = dependencies.slice(0, foregroundDependencyCount);
        const backgroundDependencies = dependencies.slice(foregroundDependencyCount);

        const backgroundDependencyGroups = partition(backgroundDependencies, VIEWPORT_SIZE);

        const foregroundLock = foregroundDependencies
          .map(getSuggestionsForDescriptor)
          .reduce(async (lock, currentSuggestionPromise) => {
            await lock;

            const currentSuggestion = await currentSuggestionPromise;
            if (currentSuggestion === null)
              return;

            if (!mountedRef.current)
              return;

            setSuggestions(suggestions => {
              const firstEmptySlot = suggestions.findIndex(suggestion => suggestion === null);

              const newSuggestions = [...suggestions];
              newSuggestions[firstEmptySlot] = currentSuggestion;

              return newSuggestions;
            });
          }, Promise.resolve());

        backgroundDependencyGroups.reduce((lock, group) =>
          Promise.all(group.map(descriptor => Promise.resolve().then(() => getSuggestionsForDescriptor(descriptor))))
            .then(async newSuggestions => {
              newSuggestions = newSuggestions.filter(suggestion => suggestion !== null);

              await lock;
              if (mountedRef.current) {
                setSuggestions(suggestions => {
                  const firstEmptySlot = suggestions.findIndex(suggestion => suggestion === null);
                  return suggestions
                    .slice(0, firstEmptySlot)
                    .concat(newSuggestions)
                    .concat(suggestions.slice(firstEmptySlot + newSuggestions.length));
                });
              }
            }), foregroundLock,
        ).then(() => {
          // Cleanup all empty slots
          if (mountedRef.current) {
            setSuggestions(suggestions => suggestions.filter(suggestion => suggestion !== null));
          }
        });
      }, []);

      if (!suggestions.length)
        return <Text>No upgrades found</Text>;

      return <ScrollableItems radius={VIEWPORT_SIZE >> 1} children={suggestions.map((suggestion, index) => {
        // We use the same keys so that we don't lose the selection when a suggestion finishes loading
        return suggestion !== null
          ? <UpgradeEntry key={index} active={false} descriptor={suggestion.descriptor} suggestions={suggestion.suggestions} />
          : <Text key={index}>Loading...</Text>;
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

    const updateRequests = await renderForm(GlobalListApp, {}, {
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
    });
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
