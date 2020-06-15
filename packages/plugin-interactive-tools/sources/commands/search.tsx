import {BaseCommand}                         from '@yarnpkg/cli';
import {Configuration, structUtils}          from '@yarnpkg/core';
import {ScrollableItems}                     from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                        from '@yarnpkg/libui/sources/hooks/useMinistore';
import {useSpace}                            from '@yarnpkg/libui/sources/hooks/useSpace';
import {renderForm, SubmitInjectedComponent} from '@yarnpkg/libui/sources/misc/renderForm';
import {Command, Usage}                      from 'clipanion';
import InkTextInput, {InkTextInputProps}     from 'ink-text-input';
import {Box, Text, Color}                    from 'ink';
import React, {useEffect, useState}          from 'react';

import {AlgoliaPackage, search}              from '../algolia';

const targets = [`regular`, `dev`, `peer`];

// eslint-disable-next-line arca/no-default-export
export default class SearchCommand extends BaseCommand {
  static usage: Usage = Command.Usage({
    category: `Interactive commands`,
    description: `open the search interface`,
    details: `
    This command opens a fullscreen terminal interface where you can search for and install packages from the npm registry.
    `,
    examples: [[
      `Open the search window`,
      `yarn search`,
    ]],
  });

  @Command.Path(`search`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const Prompt = () => {
      return (
        <Box flexDirection="row">
          <Box flexDirection="column" width={48}>
            <Box>
             Press <Color bold cyanBright>{`<up>`}</Color>/<Color bold cyanBright>{`<down>`}</Color> to move between packages.
            </Box>
            <Box>
             Press <Color bold cyanBright>{`<space>`}</Color> to select a package.
            </Box>
            <Box>
              Press <Color bold cyanBright>{`<space>`}</Color> again to change the target.
            </Box>
          </Box>
          <Box flexDirection="column">
            <Box marginLeft={1}>
              Press <Color bold cyanBright>{`<enter>`}</Color> to install the selected packages.
            </Box>
            <Box marginLeft={1}>
             Press <Color bold cyanBright>{`<ctrl+c>`}</Color> to abort.
            </Box>
          </Box>
        </Box>
      );
    };

    const SearchColumnNames = () => {
      return <>
        <Box width={15}><Color bold underline gray>Owner</Color></Box>
        <Box width={11}><Color bold underline gray>Version</Color></Box>
        <Box width={10}><Color bold underline gray>Downloads</Color></Box>
      </>;
    };

    const SelectedColumnNames = () => {
      return <Box width={17}><Color bold underline gray>Target</Color></Box>;
    };

    const HitEntry = ({hit, active}: {hit: AlgoliaPackage, active: boolean}) => {
      const [action, setAction] = useMinistore<string | null>(hit.name, null);

      useSpace({
        active,
        handler: () => {
          if (!action) {
            setAction(targets[0]);
            return;
          }

          const nextIndex = targets.indexOf(action) + 1;

          if (nextIndex === targets.length) {
            setAction(null);
          } else {
            setAction(targets[nextIndex]);
          }
        },
      });

      const ident = structUtils.parseIdent(hit.name);
      const prettyIdent = structUtils.prettyIdent(configuration, ident);

      return <Box>
        <Box width={45} textWrap="wrap">
          <Text bold>
            {prettyIdent}
          </Text>
        </Box>
        <Box width={14} textWrap="truncate" marginLeft={1}>
          <Text bold>
            {hit.owner.name}
          </Text>
        </Box>
        <Box width={10} textWrap="truncate" marginLeft={1}>
          <Text italic>
            {hit.version}
          </Text>
        </Box>
        <Box width={16} textWrap="truncate" marginLeft={1}>
          {hit.humanDownloadsLast30Days}
        </Box>
      </Box>;
    };

    const SelectedEntry = ({name, active}: {name: string, active: boolean}) => {
      const [action] = useMinistore<string | null>(name, null);

      const ident = structUtils.parseIdent(name);

      return <Box>
        <Box width={47}>
          <Text bold>
            {` - `}{structUtils.prettyIdent(configuration, ident)}
          </Text>
        </Box>
        {targets.map(
          target =>
            <Box key={target} width={14} marginLeft={1}>
              {action === target ? <Color green> ◉ </Color> : <Color yellow> ◯ </Color>}
              <Text bold>{target}</Text>
            </Box>
        )}
      </Box>;
    };

    const PoweredByAlgolia = () => {
      return <Box marginTop={1}>
        <Text>Powered by Algolia.</Text>
      </Box>;
    };

    const SearchApp: SubmitInjectedComponent<Map<string, unknown>> = ({useSubmit}) => {
      const selectionMap = useMinistore();
      useSubmit(selectionMap);

      const selectedPackages = Array.from(selectionMap.keys()).filter(pkg => selectionMap.get(pkg) !== null);

      const [query, setQuery] = useState<string>(``);
      const [page, setPage] = useState(0);
      const [hits, setHits] = useState<Array<AlgoliaPackage>>([]);

      const handleQueryOnChange = (newQuery: string) => {
        // Ignore space and tab clicks
        if (newQuery.match(/\t| /))
          return;

        setQuery(newQuery);
      };

      const fetchHits = async () => {
        setPage(0);

        const res = await search(query);

        if (res.query === query) {
          setHits(res.hits);
        }
      };

      const fetchNextPageHits = async () => {
        const res = await search(query, page + 1);

        if (res.query === query && res.page - 1 === page) {
          setPage(res.page);
          setHits([...hits, ...res.hits]);
        }
      };

      useEffect(() => {
        if (!query) {
          setHits([]);
        } else {
          fetchHits();
        }
      }, [query]);

      // Typescript is having problems with
      // recognizing InkTextInput as a valid
      // JSX element for some reason...
      const TextInput = InkTextInput as unknown as React.ComponentClass<InkTextInputProps>;

      return <Box flexDirection={`column`}>
        <Prompt />
        <Box flexDirection={`row`} marginTop={1}>
          <Text bold>Search: </Text>
          <Box width={41}>
            <TextInput
              value={query}
              onChange={handleQueryOnChange}
              placeholder={`i.e. babel, webpack, react...`}
              showCursor={false}
            />
          </Box>
          <SearchColumnNames />
        </Box>
        {hits.length ?
          <ScrollableItems
            radius={2}
            loop={false}
            children={hits.map(hit => <HitEntry key={hit.name} hit={hit} active={false} />)}
            willReachEnd={fetchNextPageHits}
          /> : <Color gray>Start typing...</Color>
        }
        <Box flexDirection={`row`} marginTop={1}>
          <Box width={49}>
            <Text bold>Selected:</Text>
          </Box>
          <SelectedColumnNames />
        </Box>
        {selectedPackages.length ?
          selectedPackages.map(
            name => <SelectedEntry key={name} name={name} active={false}/>
          ) : <Color gray>No selected packages...</Color>
        }
        <PoweredByAlgolia />
      </Box>;
    };

    const installRequests = await renderForm(SearchApp, {});
    if (typeof installRequests === `undefined`)
      return 1;

    const dependencies = Array.from(installRequests.keys()).filter(request => installRequests.get(request) === `regular`);
    const devDependencies = Array.from(installRequests.keys()).filter(request => installRequests.get(request) === `dev`);
    const peerDependencies = Array.from(installRequests.keys()).filter(request => installRequests.get(request) === `peer`);

    if (dependencies.length)
      await this.cli.run([`add`, ...dependencies]);

    if (devDependencies.length)
      await this.cli.run([`add`, `--dev`, ...devDependencies]);

    if (peerDependencies)
      await this.cli.run([`add`, `--peer`, ...peerDependencies]);

    return 0;
  }
}
