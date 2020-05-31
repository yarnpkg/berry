import {BaseCommand}                         from '@yarnpkg/cli';
import {Configuration, FormatType}           from '@yarnpkg/core';
import {ScrollableItems}                     from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useMinistore}                        from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent} from '@yarnpkg/libui/sources/misc/renderForm';
import {Command, Usage}                      from 'clipanion';
import TextInput                             from 'ink-text-input';
import {Box, Text, Color}                    from 'ink';
import React, {useEffect, useState}          from 'react';

import {AlgoliaPackage, search}              from '../algolia';

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

    const ColumnNames = () => {
      return <>
        <Box width={17}><Color bold underline gray>Owner</Color></Box>
        <Box width={17}><Color bold underline gray>Version</Color></Box>
      </>;
    };

    const HitEntry = ({hit, active}: {hit: AlgoliaPackage, active?: boolean}) => {
      // useInput(input => {
      //   if (input === ` ` && active) {

      //   }
      // });

      return <Box>
        <Box width={45} textWrap="wrap">
          <Text bold>
            {prettyName(hit.name)}
          </Text>
        </Box>
        <Box width={17}>
          <Text bold>
            {hit.owner.name}
          </Text>
        </Box>
        <Box width={17}>
          <Text bold>
            {hit.version}
          </Text>
        </Box>
      </Box>;
    };

    const SearchApp: SubmitInjectedComponent<Map<string, unknown>> = ({useSubmit}) => {
      useSubmit(useMinistore());

      const [query, setQuery] = useState<string>(``);
      const [page, setPage] = useState(0);
      const [hits, setHits] = useState<Array<AlgoliaPackage>>([]);

      const handleQueryOnChange = (newQuery: string) => {
        // Ignore space clicks
        if (newQuery.includes(` `))
          return;

        setQuery(newQuery);
      };

      const fetchHits = async () => {
        if (!query) {
          setHits([]);
          return;
        }

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
        fetchHits();
      }, [query]);

      return <Box flexDirection={`column`}>
        <Box flexDirection={`row`}>
          <Text bold>Search: </Text>
          <Box width={40}>
            {/*
            // @ts-ignore */}
            <TextInput value={query} onChange={handleQueryOnChange} placeholder={`i.e. babel, webpack, react...`} />
          </Box>
          <ColumnNames />
        </Box>
        {hits.length ?
          <ScrollableItems
            radius={3}
            children={hits.map(hit => <HitEntry key={hit.name} hit={hit} />)}
            willReachEnd={fetchNextPageHits}
          /> : <Color gray>Start typing...</Color>
        }
        <Text bold>Selected:</Text>
        <Color gray>Select some packages...</Color>
      </Box>;
    };

    const installRequests = await renderForm(SearchApp, {});
    if (typeof installRequests === `undefined`)
      return 1;

    return 0;
  }
}
