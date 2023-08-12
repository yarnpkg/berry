#!/usr/bin/env node
import {Configuration}                                         from '@yarnpkg/core';
import {Filename, NativePath, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {processCompletionProviderRequest}                      from 'clcs';
import {Module}                                                from 'module';
import which                                                   from 'which';

async function printCompletionScript(shellName: string, {selfPath}: {selfPath: PortablePath}) {
  return await processCompletionProviderRequest({
    binaryName: `yarn`,
    completionRequestCommand: `${npath.fromPortablePath(selfPath)} request`,
    shellName,
    stdout: process.stdout,
  });
}

// We load the binary into the current process,
// while making it think it was spawned.
function runBinary(binPath: NativePath, argv: Array<string>) {
  process.env.YARN_IGNORE_PATH = `1`;

  process.argv = [
    process.execPath,
    binPath,
    ...argv,
  ];
  process.execArgv = [];

  // Unset the mainModule and let Node.js set it when needed.
  process.mainModule = undefined;

  // Use nextTick to unwind the stack, and consequently remove the
  // completion engine from the stack trace of the package manager.
  process.nextTick(Module.runMain, binPath);
}

async function forwardCompletionRequest(argv: Array<string>, {selfPath}: {selfPath: PortablePath}) {
  const startingCwd = ppath.cwd();

  const projectCwd = await Configuration.findProjectCwd(startingCwd, Filename.lockfile);
  if (projectCwd !== null) {
    const lockfilePath = ppath.join(projectCwd, Filename.lockfile);
    const content = await xfs.readFilePromise(lockfilePath, `utf8`);

    const match = /__metadata:\n {2}version: (\d+)/.exec(content);
    const lockfileVersion = Number(match?.[1] ?? -1);
    if (lockfileVersion >= 9) {
      const configuration = await Configuration.find(startingCwd, null, {
        strict: false,
        usePathCheck: selfPath,
      });

      const yarnPath = configuration.get(`yarnPath`);
      const ignorePath = configuration.get(`ignorePath`);

      const yarnArgs = [`completion`, `request`, ...argv];
      const binPath = yarnPath && !ignorePath
        ? npath.fromPortablePath(yarnPath)
        // TODO: ensure it's a valid JS file
        : await which(`yarn`);

      runBinary(binPath, yarnArgs);
    }
  }

  // TODO: support completions for global Yarn Modern binary
  // TODO: find a way to fallback to other completion provider (e.g. v1 completions)
}

// The completion engine supports 2 commands:
// - `engine <shell>`: prints the completion script for the specified shell
// - `engine request [...args]`: forwards the completion request to the yarn binary

const selfPath = npath.toPortablePath(process.argv[1]);

if (process.argv[2] === `request`)
  forwardCompletionRequest(process.argv.slice(3), {selfPath});
else
  printCompletionScript(process.argv[2], {selfPath});
