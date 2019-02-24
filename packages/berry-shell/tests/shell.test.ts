import {runShell}    from '@berry/shell';
import {PassThrough} from 'stream';

const bufferResult = async (command: string, args: Array<string> = []) => {
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

  const exitCode = await runShell(command, {args, stdout, stderr});

  return {
    exitCode,

    stdout: Buffer.concat(stdoutChunks).toString(),
    stderr: Buffer.concat(stderrChunks).toString(),
  };
};

describe(`Simple shell features`, () => {
  it(`should support an empty string`, async () => {
    await expect(bufferResult(``)).resolves.toMatchObject({
      exitCode: 0,
      stdout: ``,
    });
  });

  it(`should support an empty string when passing arguments`, async () => {
    await expect(bufferResult(``, [`hello`, `world`])).resolves.toMatchObject({
      exitCode: 0,
      stdout: ``,
    });
  });

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

  it(`should forward the specified exit code when running exit`, async () => {
    await expect(bufferResult(`exit 1`)).resolves.toMatchObject({
      exitCode: 1,
    });

    await expect(bufferResult(`exit 42`)).resolves.toMatchObject({
      exitCode: 42,
    });
  });

  it(`should shortcut the right branch of a '||' when the left branch succeeds`, async () => {
    await expect(bufferResult(`true || echo failed`)).resolves.toMatchObject({
      stdout: ``,
    });
  });
  
  it(`should shortcut the right branch of a '&&' when the left branch fails`, async () => {
    await expect(bufferResult(`false && echo failed`)).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute the right branch of a '||' when the left branch fails`, async () => {
    await expect(bufferResult(`false || echo succeeds`)).resolves.toMatchObject({
      stdout: `succeeds\n`,
    });
  });

  it(`should execute the right branch of a '&&' when the left branch succeeds`, async () => {
    await expect(bufferResult(`true && echo succeeds`)).resolves.toMatchObject({
      stdout: `succeeds\n`,
    });
  });

  it(`should execute both branches regardless of their exit status when using ';'`, async () => {
    await expect(bufferResult(`echo foo; echo bar`)).resolves.toMatchObject({
      stdout: `foo\nbar\n`,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '||', shortcutted)`, async () => {
    await expect(bufferResult(`true || (echo hello; echo world)`)).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '||')`, async () => {
    await expect(bufferResult(`false || (echo hello; echo world)`)).resolves.toMatchObject({
      stdout: `hello\nworld\n`,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '&&', shortcutted)`, async () => {
    await expect(bufferResult(`false && (echo hello; echo world)`)).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '&&')`, async () => {
    await expect(bufferResult(`true && (echo hello; echo world)`)).resolves.toMatchObject({
      stdout: `hello\nworld\n`,
    });
  });

  it(`should allow subshells to access the $? from the parent shell`, async () => {
    await expect(bufferResult(`false; (echo $?)`)).resolves.toMatchObject({
      stdout: `1\n`,
    });
  });

  it(`should expose the previous exit code via $?`, async () => {
    await expect(bufferResult(`true; echo $?`)).resolves.toMatchObject({
      stdout: `0\n`,
    });

    await expect(bufferResult(`false; echo $?`)).resolves.toMatchObject({
      stdout: `1\n`,
    });
  });

  it(`should expose the number of arguments via $#`, async () => {
    await expect(bufferResult(`echo $#`)).resolves.toMatchObject({
      stdout: `0\n`,
    });

    await expect(bufferResult(`echo $#`, [`hello`, `world`])).resolves.toMatchObject({
      stdout: `2\n`,
    });
  });

  it(`should expose individual arguments via $0, $1, ..., $n`, async () => {
    await expect(bufferResult(`echo $0`, [`hello`, `world`])).resolves.toMatchObject({
      stdout: `hello\n`,
    });

    await expect(bufferResult(`echo $1`, [`hello`, `world`])).resolves.toMatchObject({
      stdout: `world\n`,
    });
  });
});
