import {BaseCommand}                         from '@yarnpkg/cli';
import {Configuration, structUtils}          from '@yarnpkg/core';
import {Gem}                                 from '@yarnpkg/libui/sources/components/Gem';
import {ScrollableItems}                     from '@yarnpkg/libui/sources/components/ScrollableItems';
import {useKeypress}                         from '@yarnpkg/libui/sources/hooks/useKeypress';
import {useMinistore}                        from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent} from '@yarnpkg/libui/sources/misc/renderForm';
import {Command, Usage}                      from 'clipanion';
import InkTextInput                          from 'ink-text-input';
import {Box, Text}                           from 'ink';
import React, {useEffect, useState}          from 'react';

import {AlgoliaPackage, search}              from '../algolia';

const TARGETS = [`regular`, `dev`, `peer`];

// eslint-disable-next-line arca/no-default-export
export default class SearchCommand extends BaseCommand {
  static paths = [
    [`search`],
  ];

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

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const Prompt = () => {
      return (
        <Box flexDirection={`row`}>
          <Box flexDirection={`column`} width={48}>
            <Box>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<up>`}</Text>/<Text bold color={`cyanBright`}>{`<down>`}</Text> to move between packages.
              </Text>
            </Box>
            <Box>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<space>`}</Text> to select a package.
              </Text>
            </Box>
            <Box>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<space>`}</Text> again to change the target.
              </Text>
            </Box>
          </Box>
          <Box flexDirection={`column`}>
            <Box marginLeft={1}>
              <Text>
                Press <Text bold color={`cyanBright`}>{`<enter>`}</Text> to install the selected packages.
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

    const SearchColumnNames = () => {
      return <>
        <Box width={15}><Text bold underline color={`gray`}>Owner</Text></Box>
        <Box width={11}><Text bold underline color={`gray`}>Version</Text></Box>
        <Box width={10}><Text bold underline color={`gray`}>Downloads</Text></Box>
      </>;
    };

    const SelectedColumnNames = () => {
      return <Box width={17}><Text bold underline color={`gray`}>Target</Text></Box>;
    };

    const HitEntry = ({hit, active}: {hit: AlgoliaPackage, active: boolean}) => {
      const [action, setAction] = useMinistore<string | null>(hit.name, null);

      useKeypress({active}, (ch, key) => {
        if (key.name !== `space`)
          return;

        if (!action) {
          setAction(TARGETS[0]);
          return;
        }

        const nextIndex = TARGETS.indexOf(action) + 1;
        if (nextIndex === TARGETS.length) {
          setAction(null);
        } else {
          setAction(TARGETS[nextIndex]);
        }
      }, [
        action,
        setAction,
      ]);

      const ident = structUtils.parseIdent(hit.name);
      const prettyIdent = structUtils.prettyIdent(configuration, ident);

      return (
        <Box>
          <Box width={45}>
            <Text bold wrap={`wrap`}>
              {prettyIdent}
            </Text>
          </Box>
          <Box width={14} marginLeft={1}>
            <Text bold wrap={`truncate`}>
              {hit.owner.name}
            </Text>
          </Box>
          <Box width={10} marginLeft={1}>
            <Text italic wrap={`truncate`}>
              {hit.version}
            </Text>
          </Box>
          <Box width={16} marginLeft={1}>
            <Text>
              {hit.humanDownloadsLast30Days}
            </Text>
          </Box>
        </Box>
      );
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
        {TARGETS.map(
          target =>
            <Box key={target} width={14} marginLeft={1}>
              <Text>
                {` `}<Gem active={action === target} />{` `}
                <Text bold>{target}</Text>
              </Text>
            </Box>,
        )}
      </Box>;
    };

    const PoweredByAlgolia = () => (
      <Box marginTop={1}>
        <Text>Powered by Algolia.</Text>
      </Box>
    );

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

      return (
        <Box flexDirection={`column`}>
          <Prompt />
          <Box flexDirection={`row`} marginTop={1}>
            <Text bold>Search: </Text>
            <Box width={41}>
              <InkTextInput
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
            /> : <Text color={`gray`}>Start typing...</Text>
          }
          <Box flexDirection={`row`} marginTop={1}>
            <Box width={49}>
              <Text bold>Selected:</Text>
            </Box>
            <SelectedColumnNames />
          </Box>
          {selectedPackages.length ?
            selectedPackages.map(
              name => <SelectedEntry key={name} name={name} active={false}/>,
            ) : <Text color={`gray`}>No selected packages...</Text>
          }
          <PoweredByAlgolia />
        </Box>
      );
    };

    const installRequests = await renderForm(SearchApp, {}, {
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
    });
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
