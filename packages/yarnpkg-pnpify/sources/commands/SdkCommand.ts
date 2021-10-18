import {Command, Option, UsageError} from 'clipanion';

// TODO: remove error message in next major

// eslint-disable-next-line arca/no-default-export
export default class SdkCommand extends Command {
  static paths = [
    [`--sdk`],
  ];

  args = Option.Proxy();

  async execute() {
    throw new UsageError(`The 'pnpify --sdk ...' command has been moved to the '@yarnpkg/sdks' package - use 'yarn dlx @yarnpkg/sdks ...' instead`);
  }
}
