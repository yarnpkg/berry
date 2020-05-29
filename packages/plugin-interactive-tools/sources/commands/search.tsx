import {BaseCommand}                         from '@yarnpkg/cli';
import {useMinistore}                        from '@yarnpkg/libui/sources/hooks/useMinistore';
import {renderForm, SubmitInjectedComponent} from '@yarnpkg/libui/sources/misc/renderForm';
import {Command, Usage}                      from 'clipanion';
import {Box}                                 from 'ink';
import React                                 from 'react';

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
    const SearchApp: SubmitInjectedComponent<Map<string, unknown>> = ({useSubmit}) => {
      useSubmit(useMinistore());

      return <Box flexDirection={`column`}>Search press enter to procced.</Box>;
    };

    const installRequests = await renderForm(SearchApp, {});
    if (typeof installRequests === `undefined`)
      return 1;

    console.log(`You requested to install the following packages.`);

    return 0;
  }
}
