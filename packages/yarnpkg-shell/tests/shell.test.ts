import {npath, xfs}  from '@yarnpkg/fslib';
import {execute}     from '@yarnpkg/shell';
import {PassThrough} from 'stream';
import {fileSync}    from 'tmp';

const ifNotWin32It = process.platform !== `win32`
  ? it
  : it.skip;

const bufferResult = async (command: string, args: Array<string> = [], options: any = {}) => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  const stdoutChunks: Array<Buffer> = [];
  const stderrChunks: Array<Buffer> = [];

  stdout.on(`data`, chunk => {
    stdoutChunks.push(chunk);
  });

  stderr.on(`data`, chunk => {
    stderrChunks.push(chunk);
  });

  const exitCode = await execute(command, args, {...options, stdout, stderr, builtins: {
    [`test-builtin`]: async (args, opts, state) => {
      const stdinChunks: Array<Buffer> = [];

      state.stdin.on(`data`, chunk => {
        stdinChunks.push(chunk);
      });

      return await new Promise (resolve => {
        state.stdin.on(`end`, () => {
          const content = Buffer.concat(stdinChunks).toString().trim();
          state.stdout.write(`${content.replace(/(.)./g, `$1`)}\n`);

          resolve(0);
        });
      });
    },
  }});

  return {
    exitCode,

    stdout: Buffer.concat(stdoutChunks).toString(),
    stderr: Buffer.concat(stderrChunks).toString(),
  };
};

describe(`Simple shell features`, () => {
  it(`should support an empty string`, async () => {
    await expect(bufferResult(
      ``,
    )).resolves.toMatchObject({
      exitCode: 0,
      stdout: ``,
    });
  });

  it(`should support an empty string when passing arguments`, async () => {
    await expect(bufferResult(
      ``,
      [`hello`, `world`],
    )).resolves.toMatchObject({
      exitCode: 0,
      stdout: ``,
    });
  });

  it(`should execute a regular command`, async () => {
    await expect(bufferResult(
      `echo hello`,
    )).resolves.toMatchObject({
      stdout: `hello\n`,
    });
  });

  it(`should exit with an exit code 0 when everything looks fine`, async () => {
    await expect(bufferResult(
      `echo hello`,
    )).resolves.toMatchObject({
      exitCode: 0,
    });
  });

  ifNotWin32It(`should throw an error when a command doesn't exist`, async () => {
    await expect(bufferResult(
      `this-command-doesnt-exist-sorry`,
    )).resolves.toMatchObject({
      exitCode: 127,
      stderr: `command not found: this-command-doesnt-exist-sorry\n`,
    });
  });

  it(`should forward the specified exit code when running exit`, async () => {
    await expect(bufferResult(
      `exit 1`,
    )).resolves.toMatchObject({
      exitCode: 1,
    });

    await expect(bufferResult(
      `exit 42`,
    )).resolves.toMatchObject({
      exitCode: 42,
    });
  });

  it(`should pipe the result of a command into another (two commands, builtin into native)`, async () => {
    await expect(bufferResult([
      `echo hello world`,
      `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
    ].join(` | `))).resolves.toMatchObject({
      stdout: `HELLO WORLD\n`,
    });
  });

  it(`should pipe the result of a command into another (two commands, native into pipe)`, async () => {
    await expect(bufferResult([
      `node -e 'process.stdout.write("abcdefgh\\\\n");'`,
      `test-builtin`,
    ].join(` | `))).resolves.toMatchObject({
      stdout: `aceg\n`,
    });
  });

  it(`should pipe the result of a command into another (three commands)`, async () => {
    await expect(bufferResult([
      `echo hello world`,
      `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
      `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().replace(/./g, $0 => \`{\${$0}}\`)))'`,
    ].join(` | `))).resolves.toMatchObject({
      stdout: `{H}{E}{L}{L}{O}{ }{W}{O}{R}{L}{D}\n`,
    });
  });

  it(`should pipe the result of a command into another (no builtins)`, async () => {
    await expect(bufferResult([
      `node -e 'process.stdout.write("hello world\\\\n")'`,
      `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
      `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().replace(/./g, $0 => \`{\${$0}}\`)))'`,
    ].join(` | `))).resolves.toMatchObject({
      stdout: `{H}{E}{L}{L}{O}{ }{W}{O}{R}{L}{D}\n`,
    });
  });

  it(`should pipe the result of a command into another (only builtins)`, async () => {
    await expect(bufferResult([
      `echo abcdefghijkl`,
      `test-builtin`,
      `test-builtin`,
    ].join(` | `))).resolves.toMatchObject({
      stdout: `aei\n`,
    });
  });

  it(`should shortcut the right branch of a '||' when the left branch succeeds`, async () => {
    await expect(bufferResult(
      `true || echo failed`,
    )).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should shortcut the right branch of a '&&' when the left branch fails`, async () => {
    await expect(bufferResult(
      `false && echo failed`,
    )).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute the right branch of a '||' when the left branch fails`, async () => {
    await expect(bufferResult(
      `false || echo succeeds`,
    )).resolves.toMatchObject({
      stdout: `succeeds\n`,
    });
  });

  it(`should execute the right branch of a '&&' when the left branch succeeds`, async () => {
    await expect(bufferResult(
      `true && echo succeeds`,
    )).resolves.toMatchObject({
      stdout: `succeeds\n`,
    });
  });

  it(`should execute both branches regardless of their exit status when using ';'`, async () => {
    await expect(bufferResult(
      `echo foo; echo bar`,
    )).resolves.toMatchObject({
      stdout: `foo\nbar\n`,
    });
  });

  it(`should immediatly stop the execution when calling 'exit'`, async () => {
    await expect(bufferResult(
      `echo hello; exit 1; echo world`,
    )).resolves.toMatchObject({
      exitCode: 1,
      stdout: `hello\n`,
    });

    await expect(bufferResult(
      `echo hello && exit 0 && echo world`,
    )).resolves.toMatchObject({
      exitCode: 0,
      stdout: `hello\n`,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '||', shortcutted)`, async () => {
    await expect(bufferResult(
      `true || (echo hello; echo world)`,
    )).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '||')`, async () => {
    await expect(bufferResult(
      `false || (echo hello; echo world)`,
    )).resolves.toMatchObject({
      stdout: `hello\nworld\n`,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '&&', shortcutted)`, async () => {
    await expect(bufferResult(
      `false && (echo hello; echo world)`,
    )).resolves.toMatchObject({
      stdout: ``,
    });
  });

  it(`should execute a subshell when using grouping parentheses (within '&&')`, async () => {
    await expect(bufferResult(
      `true && (echo hello; echo world)`,
    )).resolves.toMatchObject({
      stdout: `hello\nworld\n`,
    });
  });

  it(`should allow subshells to access the $? from the parent shell`, async () => {
    await expect(bufferResult(
      `false; (echo $?)`,
    )).resolves.toMatchObject({
      stdout: `1\n`,
    });
  });

  it(`should expose the previous exit code via $?`, async () => {
    await expect(bufferResult(
      `true; echo $?`,
    )).resolves.toMatchObject({
      stdout: `0\n`,
    });

    await expect(bufferResult(
      `false; echo $?`,
    )).resolves.toMatchObject({
      stdout: `1\n`,
    });
  });

  it(`should expose the number of arguments via $#`, async () => {
    await expect(bufferResult(
      `echo $#`,
    )).resolves.toMatchObject({
      stdout: `0\n`,
    });

    await expect(bufferResult(
      `echo $#`,
      [`hello`, `world`],
    )).resolves.toMatchObject({
      stdout: `2\n`,
    });
  });

  it(`should expose individual arguments via $0, $1, ..., $n`, async () => {
    await expect(bufferResult(
      `echo $0`,
      [`hello`, `world`],
    )).resolves.toMatchObject({
      stdout: `hello\n`,
    });

    await expect(bufferResult(
      `echo $1`,
      [`hello`, `world`],
    )).resolves.toMatchObject({
      stdout: `world\n`,
    });
  });

  it(`should support argument spread via $@`, async () => {
    await expect(bufferResult(
      `node -p 'JSON.stringify(process.argv.slice(1))' "$@"`,
      [`hello`, `world`],
    )).resolves.toMatchObject({
      stdout: `["hello","world"]\n`,
    });
  });

  it(`should set environment variables`, async () => {
    await expect(bufferResult(
      `PORT=1234 node -e 'process.stdout.write(process.env.PORT)'`
    )).resolves.toMatchObject({
      stdout: `1234`,
    });
  });

  it(`should support setting multiple environment variables`, async () => {
    await expect(bufferResult(
      `HOST="localhost" PORT=1234 node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`
    )).resolves.toMatchObject({
      stdout: `localhost:1234`,
    });
  });

  it(`should support setting environment variables with shell interpolation`, async () => {
    await expect(bufferResult(
      `HOST="local"$(echo $0) PORT=1234 node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`,
      [`host`]
    )).resolves.toMatchObject({
      stdout: `localhost:1234`,
    });
  });

  it(`should support setting env variable without command`, async () => {
    await expect(bufferResult([
      `FOO=1`,
      `FOO=2`,
      `node -e 'process.stdout.write(process.env.FOO)'`,
    ].join(` ; `))).resolves.toMatchObject({
      stdout: `2`,
    });
  });

  it(`should evaluate variables once before starting execution`, async () => {
    await expect(bufferResult([
      `FOO=1`,
      `FOO=2 echo $FOO`,
    ].join(` ; `))).resolves.toMatchObject({
      stdout: `1\n`,
    });
  });

  it(`should clear an env variable if value is omitted`, async () => {
    await expect(bufferResult(
      `HOST="localhost" PORT=1234 HOST= node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`
    )).resolves.toMatchObject({
      stdout: `:1234`,
    });
  });

  it(`env assignment prefix syntax shouldn't persist it to the environment`, async () => {
    await expect(bufferResult([
      `FOO=1`,
      `FOO=2 echo hello`,
      `echo $FOO`,
    ].join(` ; `))).resolves.toMatchObject({
      stdout: `hello\n1\n`,
    });

    await expect(bufferResult([
      `FOO=1`,
      `FOO=2 echo hello`,
      `node -e 'process.stdout.write(process.env.FOO)'`,
    ].join(` ; `))).resolves.toMatchObject({
      stdout: `hello\n1`,
    });

    await expect(bufferResult(`FOO=2 echo hello ; echo $FOO`)).rejects.toThrowError(/Unbound variable/);
  });

  it(`should support multiple env assignment without command`, async () => {
    await expect(bufferResult([
      `FOO=1 BAR=2`,
      `echo hello`,
      `echo $BAR`,
    ].join(` ; `))).resolves.toMatchObject({
      stdout: `hello\n2\n`,
    });
  });

  it(`should support using environment variables`, async () => {
    await expect(bufferResult(
      `echo $FOOBAR`,
      [],
      {env: {FOOBAR: `hello world`}}
    )).resolves.toMatchObject({
      stdout: `hello world\n`,
    });
  });

  it(`should support default arguments via \${...:-...}`, async () => {
    await expect(bufferResult(
      `echo "\${DOESNT_EXIST:-hello world}"`,
    )).resolves.toMatchObject({
      stdout: `hello world\n`,
    });
  });

  it(`should support empty default arguments`, async () => {
    await expect(bufferResult(
      `echo "foo\${DOESNT_EXIST:-}bar"`,
    )).resolves.toMatchObject({
      stdout: `foobar\n`,
    });
  });

  it(`should support input redirections (file)`, async () => {
    const file = npath.toPortablePath(fileSync({discardDescriptor: true}).name);
    await xfs.writeFilePromise(file, `hello world\n`);

    await expect(bufferResult(
      `cat < "${file}"`,
    )).resolves.toMatchObject({
      stdout: `hello world\n`,
    });
  });

  it(`should support input redirections (string)`, async () => {
    await expect(bufferResult(
      `cat <<< "hello world"`,
    )).resolves.toMatchObject({
      stdout: `hello world\n`,
    });
  });

  it(`should support output redirections (overwrite)`, async () => {
    const file = npath.toPortablePath(fileSync({discardDescriptor: true}).name);

    await expect(bufferResult(
      `echo "hello world" > "${file}"`,
    )).resolves.toMatchObject({
      stdout: ``,
    });

    await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
  });

  it(`should support output redirections (append)`, async () => {
    const file = npath.toPortablePath(fileSync({discardDescriptor: true}).name);
    await xfs.writeFilePromise(file, `foo bar baz\n`);

    await expect(bufferResult(
      `echo "hello world" >> "${file}"`,
    )).resolves.toMatchObject({
      stdout: ``,
    });

    await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo bar baz\nhello world\n`);
  });

  it(`should support multiple outputs`, async () => {
    const file1 = npath.toPortablePath(fileSync({discardDescriptor: true}).name);
    const file2 = npath.toPortablePath(fileSync({discardDescriptor: true}).name);

    await expect(bufferResult(
      `echo "hello world" > "${file1}" > "${file2}"`,
    )).resolves.toMatchObject({
      stdout: ``,
    });

    await expect(xfs.readFilePromise(file1, `utf8`)).resolves.toEqual(`hello world\n`);
    await expect(xfs.readFilePromise(file2, `utf8`)).resolves.toEqual(`hello world\n`);
  });

  it(`should support multiple inputs`, async () => {
    const file1 = npath.toPortablePath(fileSync({discardDescriptor: true}).name);
    await xfs.writeFilePromise(file1, `foo bar baz\n`);

    const file2 = npath.toPortablePath(fileSync({discardDescriptor: true}).name);
    await xfs.writeFilePromise(file2, `hello world\n`);

    await expect(bufferResult(
      `cat < "${file1}" < "${file2}"`,
    )).resolves.toMatchObject({
      stdout: `foo bar baz\nhello world\n`,
    });
  });
});
