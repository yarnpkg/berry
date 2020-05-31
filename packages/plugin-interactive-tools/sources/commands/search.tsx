import {BaseCommand}                         from '@yarnpkg/cli';
import {Configuration, FormatType}           from '@yarnpkg/core';
import {ScrollableItems}                     from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                        from '@yarnpkg/libui/sources/hooks/useMinistore';
import {useSpace}                            from '@yarnpkg/libui/sources/hooks/useSpace';
import {renderForm, SubmitInjectedComponent} from '@yarnpkg/libui/sources/misc/renderForm';
import {Command, Usage}                      from 'clipanion';
import TextInput                             from 'ink-text-input';
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

    const prettyName = (name: string) => {
      const hasScope = name.includes(`/`);

      if (hasScope) {
        const [scope, descriptor] = name.split(`/`);
        return <>{configuration.format(`${scope}/`, FormatType.SCOPE)}{configuration.format(descriptor, FormatType.NAME)}</>;
      } else {
        return configuration.format(name, FormatType.NAME);
      }
    };

    const SearchColumnNames = () => {
      return <>
        <Box width={17}><Color bold underline gray>Owner</Color></Box>
        <Box width={17}><Color bold underline gray>Version</Color></Box>
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

      return <Box>
        <Box width={45} textWrap="wrap">
          <Text bold>
            {prettyName(hit.name)}
          </Text>
        </Box>
        <Box width={16} textWrap="truncate" marginLeft={1}>
          <Text bold>
            {hit.owner.name}
          </Text>
        </Box>
        <Box width={16} textWrap="truncate" marginLeft={1}>
          {hit.version}
        </Box>
      </Box>;
    };

    const SelectedEntry = ({name, active}: {name: string, active: boolean}) => {
      const [action] = useMinistore<string | null>(name, null);

      return <Box>
        <Box width={47}>
          <Text bold>
            {` - `}{prettyName(name)}
          </Text>
        </Box>
        {targets.map(
          target =>
            <Box key={target} width={16} marginLeft={1}>
              {action === target ? <Color green> ◉ </Color> : <Color yellow> ◯ </Color>}
              <Text bold>{target}</Text>
            </Box>
        )}
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

      return <Box flexDirection={`column`}>
        <Box flexDirection={`row`}>
          <Text bold>Search: </Text>
          <Box width={41}>
            {/*
            // @ts-ignore */}
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
            children={hits.map(hit => <HitEntry key={hit.name} hit={hit} active={false} />)}
            willReachEnd={fetchNextPageHits}
          /> : <Color gray>Start typing...</Color>
        }
        <Box flexDirection={`row`}>
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
      </Box>;
    };

    const installRequests = await renderForm(SearchApp, {});
    if (typeof installRequests === `undefined`)
      return 1;

    return 0;
  }
}
