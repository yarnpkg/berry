import {xfs, ppath, Filename, PortablePath} from '@yarnpkg/fslib';
import {execute, UserOptions}               from '@yarnpkg/shell';
import {PassThrough}                        from 'stream';

const isNotWin32 = process.platform !== `win32`;

const ifNotWin32It = isNotWin32
  ? it
  : it.skip;

const bufferResult = async (command: string, args: Array<string> = [], options: Partial<UserOptions> = {}) => {
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

      return await new Promise(resolve => {
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

describe(`Shell`, () => {
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

    it(`should interpolate subshells with the proper split`, async () => {
      await expect(bufferResult(
        `echo $(echo foo)bar`,
      )).resolves.toMatchObject({
        stdout: `foobar\n`,
      });
    });

    it(`should interpolate subshells with the proper split`, async () => {
      await expect(bufferResult(
        `echo $(echo 'foo      bar')bar`,
      )).resolves.toMatchObject({
        stdout: `foo barbar\n`,
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
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file` as Filename);
        await xfs.writeFilePromise(file, `hello world\n`);

        await expect(bufferResult(
          `cat < "${file}"`,
        )).resolves.toMatchObject({
          stdout: `hello world\n`,
        });
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
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file` as Filename);

        await expect(bufferResult(
          `echo "hello world" > "${file}"`,
        )).resolves.toMatchObject({
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
      });
    });

    it(`should support output redirections (append)`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file` as Filename);
        await xfs.writeFilePromise(file, `foo bar baz\n`);

        await expect(bufferResult(
          `echo "hello world" >> "${file}"`,
        )).resolves.toMatchObject({
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo bar baz\nhello world\n`);
      });
    });

    it(`should support multiple outputs`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file1 = ppath.join(tmpDir, `file1` as Filename);
        const file2 = ppath.join(tmpDir, `file2` as Filename);

        await expect(bufferResult(
          `echo "hello world" > "${file1}" > "${file2}"`,
        )).resolves.toMatchObject({
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file1, `utf8`)).resolves.toEqual(`hello world\n`);
        await expect(xfs.readFilePromise(file2, `utf8`)).resolves.toEqual(`hello world\n`);
      });
    });

    it(`should support multiple inputs`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file1 = ppath.join(tmpDir, `file1` as Filename);
        await xfs.writeFilePromise(file1, `foo bar baz\n`);

        const file2 = ppath.join(tmpDir, `file2` as Filename);
        await xfs.writeFilePromise(file2, `hello world\n`);

        await expect(bufferResult(
          `cat < "${file1}" < "${file2}"`,
        )).resolves.toMatchObject({
          stdout: `foo bar baz\nhello world\n`,
        });
      });
    });

    it(`should support redirections on subshells`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file` as Filename);

        await expect(bufferResult(
          `(echo "hello world") > "${file}"`,
        )).resolves.toMatchObject({
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
      });
    });
  });

  describe(`Glob support`, () => {
    describe(`Basic Syntax`, () => {
      it(`should support glob patterns with asterisk`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `b.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `c.txt` as Filename), ``);

          await expect(bufferResult(
            `echo *`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txt b.txt c.txt\n`,
          });

          await expect(bufferResult(
            `echo *.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txt b.txt c.txt\n`,
          });
        });
      });

      it(`should support glob patterns with globstar`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.mkdirpPromise(ppath.join(tmpDir, `foo/bar` as PortablePath));

          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo/b.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo/bar/c.txt` as Filename), ``);

          await expect(bufferResult(
            `echo **`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txt foo/b.txt foo/bar/c.txt\n`,
          });

          await expect(bufferResult(
            `echo **/*.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txt foo/b.txt foo/bar/c.txt\n`,
          });
        });
      });

      it(`should support glob patterns with question mark`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `ax.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `axxa.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txtx` as Filename), ``);

          await expect(bufferResult(
            `echo a?.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `ax.txt\n`,
          });

          await expect(bufferResult(
            `echo a??a.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `axxa.txt\n`,
          });

          await expect(bufferResult(
            `echo a.txt?`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txtx\n`,
          });
        });
      });

      it(`should support glob patterns with sequence`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `a1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `a2.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `a3.txt` as Filename), ``);

          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.js` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.ts` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.cs` as Filename), ``);

          await expect(bufferResult(
            `echo a[23].txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a2.txt a3.txt\n`,
          });

          await expect(bufferResult(
            `echo foo.[jt]s`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `foo.js foo.ts\n`,
          });

          await expect(bufferResult(
            `echo foo.[!jt]s`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `foo.cs\n`,
          });

          await expect(bufferResult(
            `echo foo.[^jt]s`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `foo.cs\n`,
          });
        });
      });

      it(`should support glob patterns with escape characters`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          if (isNotWin32) {
            await xfs.writeFilePromise(ppath.join(tmpDir, `a*b.txt` as Filename), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `a?b.txt` as Filename), ``);
          }

          await xfs.writeFilePromise(ppath.join(tmpDir, `a{c,d}b.txt` as Filename), ``);

          if (isNotWin32) {
            await expect(bufferResult(
              `echo a\\*b.txt`,
              [],
              {cwd: tmpDir}
            )).resolves.toMatchObject({
              stdout: `a*b.txt\n`,
            });

            await expect(bufferResult(
              `echo a\\?b.txt`,
              [],
              {cwd: tmpDir}
            )).resolves.toMatchObject({
              stdout: `a?b.txt\n`,
            });
          }

          await expect(bufferResult(
            `echo a\\{c,d}b.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a{c,d}b.txt\n`,
          });
        });
      });
    });

    describe(`Advanced Syntax`, () => {
      it(`should support glob patterns with posix character classes`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `abc.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `123.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo123.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `BAR.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `hello_world123.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `&434)hello.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `😀.txt` as Filename), ``);

          await expect(bufferResult(
            `echo +([[:alnum:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `123.txt BAR.txt abc.txt foo.txt foo123.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:alpha:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `BAR.txt abc.txt foo.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:ascii:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `&434)hello.txt 123.txt BAR.txt abc.txt foo.txt foo123.txt hello_world123.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:digit:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `123.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:lower:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `abc.txt foo.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:upper:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `BAR.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:word:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `123.txt BAR.txt abc.txt foo.txt foo123.txt hello_world123.txt\n`,
          });

          await expect(bufferResult(
            `echo +([[:xdigit:]]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `123.txt abc.txt\n`,
          });
        });
      });

      it(`should support glob patterns with extglobs`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `f.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fo.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooo.txt` as Filename), ``);

          await expect(bufferResult(
            `echo f@(o).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `fo.txt\n`,
          });

          await expect(bufferResult(
            `echo f*(o).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `f.txt fo.txt foo.txt fooo.txt\n`,
          });

          await expect(bufferResult(
            `echo f+(o).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `fo.txt foo.txt fooo.txt\n`,
          });

          await expect(bufferResult(
            `echo f?(o).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `f.txt fo.txt\n`,
          });

          await expect(bufferResult(
            `echo f!(o).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `f.txt\n`,
          });
        });
      });

      it(`should support glob patterns with braces`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `b.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `c.txt` as Filename), ``);

          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.js` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.ts` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `foo.vue` as Filename), ``);

          await xfs.writeFilePromise(ppath.join(tmpDir, `cbaxbc.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `cbstbc.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `ftaxwy.txt` as Filename), ``);

          await xfs.writeFilePromise(ppath.join(tmpDir, `abc.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `acd.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `ade.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `aef.txt` as Filename), ``);

          await expect(bufferResult(
            `echo {a,b}.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `a.txt b.txt\n`,
          });

          await expect(bufferResult(
            `echo {cb,ft}{ax,st}{bc,wy}.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `cbaxbc.txt cbstbc.txt ftaxwy.txt\n`,
          });

          await expect(bufferResult(
            `echo a{bc,{cd,{de,ef}}}.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `abc.txt acd.txt ade.txt aef.txt\n`,
          });
        });
      });

      it(`should support glob patterns with regexp character classes`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `abcd.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `abcdxyz.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `12345.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `0123456789.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `abcdxyz0123456789.txt` as Filename), ``);

          await expect(bufferResult(
            `echo +([a-d]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `abcd.txt\n`,
          });

          await expect(bufferResult(
            `echo +([1-5]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `12345.txt\n`,
          });

          await expect(bufferResult(
            `echo +([a-d])+([x-z])+([0-9]).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `abcdxyz0123456789.txt\n`,
          });
        });
      });

      it(`should support glob patterns with regexp groups`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `ab12.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `pq56.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `xy89.txt` as Filename), ``);

          await xfs.writeFilePromise(ppath.join(tmpDir, `foox1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooxa1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooxb1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooy1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooya1.txt` as Filename), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `fooyb1.txt` as Filename), ``);

          await expect(bufferResult(
            `echo (ab|xy)(12|89).txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `ab12.txt xy89.txt\n`,
          });

          await expect(bufferResult(
            `echo foo(x!(a)|y!(b))1.txt`,
            [],
            {cwd: tmpDir}
          )).resolves.toMatchObject({
            stdout: `foox1.txt fooxb1.txt fooy1.txt fooya1.txt\n`,
          });
        });
      });
    });
  });
});
