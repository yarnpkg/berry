import {runShell}    from '@berry/shell';
import {PassThrough} from 'stream';

const bufferResult = async (command: string, opts: any = {}) => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  const stdoutChunks = [];
  const stderrChunks = [];

  stdout.on(`data`, chunk => {
    stdoutChunks.push(chunk);
  });

  stderr.on(`data`, chunk => {
    stderrChunks.push(chunk);
  });

  const exitCode = await runShell(command, {... opts, stdout, stderr});

  return {
    exitCode,

    stdout: Buffer.concat(stdoutChunks).toString(),
    stderr: Buffer.concat(stderrChunks).toString(),
  };
};

describe(`Shell`, () => {
  it(`should execute a regular command`, async () => {
    await expect(bufferResult(`echo hello`)).resolves.toMatchObject({
      stdout: `hello\n`,
    });
  });

  it(`should exit with an exit code 0 when everything looks fine`, async () => {
    await expect(bufferResult(`echo hello`)).resolves.toMatchObject({
      exitCode: 0,
    });
  });
});
