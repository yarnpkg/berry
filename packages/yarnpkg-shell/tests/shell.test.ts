import {xfs, ppath, PortablePath} from '@yarnpkg/fslib';
import {execute, UserOptions}     from '@yarnpkg/shell';
import {PassThrough}              from 'stream';
import stripAnsi                  from 'strip-ansi';
import {setTimeout}               from 'timers/promises';

const isNotWin32 = process.platform !== `win32`;

const ifNotWin32It = isNotWin32
  ? it
  : it.skip;

type Result = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const expectResult = async (promise: Promise<any>, {exitCode = 0, stdout = ``, stderr = ``}: Partial<Result>) => {
  return await expect(promise).resolves.toMatchObject({exitCode, stdout, stderr});
};

const bufferResult = async (command: string, args: Array<string> = [], options: Partial<UserOptions> & {tty?: boolean} = {}): Promise<Result> => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  if (options.tty) {
    (stdout as any).isTTY = true;
    (stderr as any).isTTY = true;
  }

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

    [`echo-arguments`]: async (args, opts, state) => {
      return await new Promise(resolve => {
        for (const arg of args)
          state.stdout.write(`${JSON.stringify(arg)}\n`);

        resolve(0);
      });
    },

    [`echo-stdin`]: async (args, opts, state) => {
      const stdinChunks: Array<Buffer> = [];

      state.stdin.on(`data`, chunk => {
        stdinChunks.push(chunk);
      });

      return await new Promise(resolve => {
        state.stdin.on(`end`, () => {
          const content = Buffer.concat(stdinChunks).toString().trim();
          state.stdout.write(`${content}\n`);

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
    describe(`Empty commands`, () => {
      const EMPTY_COMMAND_RESULT = {
        exitCode: 0,
        stdout: ``,
      };

      it(`should support an empty string`, async () => {
        await expectResult(bufferResult(
          ``,
        ), EMPTY_COMMAND_RESULT);
      });

      it(`should support a whitespace-only string`, async () => {
        await expectResult(bufferResult(
          ` `,
        ), EMPTY_COMMAND_RESULT);

        await expectResult(bufferResult(
          `\t`,
        ), EMPTY_COMMAND_RESULT);

        await expectResult(bufferResult(
          `  \t   \t   \t  `,
        ), EMPTY_COMMAND_RESULT);
      });

      it(`should support an empty string when passing arguments`, async () => {
        await expectResult(bufferResult(
          ``,
          [`hello`, `world`],
        ), EMPTY_COMMAND_RESULT);
      });

      it(`should support a whitespace-only string when passing arguments`, async () => {
        await expectResult(bufferResult(
          ` `,
          [`hello`, `world`],
        ), EMPTY_COMMAND_RESULT);

        await expectResult(bufferResult(
          `\t`,
          [`hello`, `world`],
        ), EMPTY_COMMAND_RESULT);

        await expectResult(bufferResult(
          `  \t   \t   \t  `,
          [`hello`, `world`],
        ), EMPTY_COMMAND_RESULT);
      });
    });

    it(`should support the ":" builtin`, async () => {
      await expectResult(bufferResult(
        `:`,
      ), {
        exitCode: 0,
        stdout: ``,
      });
    });

    it(`should execute a regular command`, async () => {
      await expectResult(bufferResult(
        `echo hello`,
      ), {
        stdout: `hello\n`,
      });
    });

    it(`should support empty string as argument`, async () => {
      await expectResult(bufferResult(
        `node -pe "process.argv[2]" "" 1`,
      ), {
        stdout: `1\n`,
      });
    });

    it(`should exit with an exit code 0 when everything looks fine`, async () => {
      await expectResult(bufferResult(
        `echo hello`,
      ), {
        stdout: `hello\n`,
        exitCode: 0,
      });
    });

    ifNotWin32It(`should throw an error when a command doesn't exist`, async () => {
      await expectResult(bufferResult(
        `this-command-doesnt-exist-sorry`,
      ), {
        exitCode: 127,
        stderr: `command not found: this-command-doesnt-exist-sorry\n`,
      });
    });

    it(`should forward the specified exit code when running exit`, async () => {
      await expectResult(bufferResult(
        `exit 1`,
      ), {
        exitCode: 1,
      });

      await expectResult(bufferResult(
        `exit 42`,
      ), {
        exitCode: 42,
      });
    });

    it(`should shortcut the right branch of a '||' when the left branch succeeds`, async () => {
      await expectResult(bufferResult(
        `true || echo failed`,
      ), {
        stdout: ``,
      });
    });

    it(`should shortcut the right branch of a '&&' when the left branch fails`, async () => {
      await expectResult(bufferResult(
        `false && echo failed`,
      ), {
        exitCode: 1,
        stdout: ``,
      });
    });

    it(`should execute the right branch of a '||' when the left branch fails`, async () => {
      await expectResult(bufferResult(
        `false || echo succeeds`,
      ), {
        stdout: `succeeds\n`,
      });
    });

    it(`should execute the right branch of a '&&' when the left branch succeeds`, async () => {
      await expectResult(bufferResult(
        `true && echo succeeds`,
      ), {
        stdout: `succeeds\n`,
      });
    });

    it(`should execute both branches regardless of their exit status when using ';'`, async () => {
      await expectResult(bufferResult(
        `echo foo; echo bar`,
      ), {
        stdout: `foo\nbar\n`,
      });
    });

    it(`should immediately stop the execution when calling 'exit'`, async () => {
      await expectResult(bufferResult(
        `echo hello; exit 1; echo world`,
      ), {
        exitCode: 1,
        stdout: `hello\n`,
      });

      await expectResult(bufferResult(
        `echo hello && exit 0 && echo world`,
      ), {
        exitCode: 0,
        stdout: `hello\n`,
      });
    });

    it(`should execute a subshell when using grouping parentheses (within '||', shortcutted)`, async () => {
      await expectResult(bufferResult(
        `true || (echo hello; echo world)`,
      ), {
        stdout: ``,
      });
    });

    it(`should execute a subshell when using grouping parentheses (within '||')`, async () => {
      await expectResult(bufferResult(
        `false || (echo hello; echo world)`,
      ), {
        stdout: `hello\nworld\n`,
      });
    });

    it(`should execute a subshell when using grouping parentheses (within '&&', shortcutted)`, async () => {
      await expectResult(bufferResult(
        `false && (echo hello; echo world)`,
      ), {
        exitCode: 1,
        stdout: ``,
      });
    });

    it(`should execute a subshell when using grouping parentheses (within '&&')`, async () => {
      await expectResult(bufferResult(
        `true && (echo hello; echo world)`,
      ), {
        stdout: `hello\nworld\n`,
      });
    });

    it(`should allow subshells to access the $? from the parent shell`, async () => {
      await expectResult(bufferResult(
        `false; (echo $?)`,
      ), {
        stdout: `1\n`,
      });
    });

    it(`should execute a group when using grouping curly braces (within '||', shortcutted)`, async () => {
      await expectResult(bufferResult(
        `true || {echo hello; echo world}`,
      ), {
        stdout: ``,
      });
    });

    it(`should execute a group when using grouping curly braces (within '||')`, async () => {
      await expectResult(bufferResult(
        `false || {echo hello; echo world}`,
      ), {
        stdout: `hello\nworld\n`,
      });
    });

    it(`should execute a group when using grouping curly braces (within '&&', shortcutted)`, async () => {
      await expectResult(bufferResult(
        `false && {echo hello; echo world}`,
      ), {
        exitCode: 1,
        stdout: ``,
      });
    });

    it(`should execute a group when using grouping curly braces (within '&&')`, async () => {
      await expectResult(bufferResult(
        `true && {echo hello; echo world}`,
      ), {
        stdout: `hello\nworld\n`,
      });
    });

    it(`should allow groups to access the $? from the current shell`, async () => {
      await expectResult(bufferResult(
        `false; {echo $?}`,
      ), {
        stdout: `1\n`,
      });
    });

    it(`should interpolate subshells with the proper split`, async () => {
      await expectResult(bufferResult(
        `echo $(echo foo)bar`,
      ), {
        stdout: `foobar\n`,
      });
    });

    it(`should interpolate subshells with the proper split`, async () => {
      await expectResult(bufferResult(
        `echo $(echo 'foo      bar')bar`,
      ), {
        stdout: `foo barbar\n`,
      });
    });

    it(`should support redirections on subshells (one command)`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file`);

        await expectResult(bufferResult(
          `(echo "hello world") > "${file}"`,
        ), {
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
      });
    });

    it(`should support redirections on subshells (multiple commands)`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file`);

        await expectResult(bufferResult(
          `(echo "hello world"; echo "goodbye world") > "${file}"`,
        ), {
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\ngoodbye world\n`);
      });
    });

    it(`should support redirections on groups (one command)`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file`);

        await expectResult(bufferResult(
          `{echo "hello world"} > "${file}"`,
        ), {
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
      });
    });

    it(`should support redirections on groups (multiple commands)`, async () => {
      await xfs.mktempPromise(async tmpDir => {
        const file = ppath.join(tmpDir, `file`);

        await expectResult(bufferResult(
          `{echo "hello world"; echo "goodbye world"} > "${file}"`,
        ), {
          stdout: ``,
        });

        await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\ngoodbye world\n`);
      });
    });

    it(`shouldn't allow subshells to mutate the state of the parent shell`, async () => {
      await expectResult(bufferResult(
        `(FOO=hello); echo $FOO`,
      ), {
        exitCode: 1,
        stderr: `Unbound variable "FOO"\n`,
      });
    });

    it(`should allow groups to mutate the state of the current shell`, async () => {
      await expectResult(bufferResult(
        `{FOO=hello}; echo $FOO`,
      ), {
        stdout: `hello\n`,
      });
    });
  });

  describe(`Variables`, () => {
    describe(`Built-in variables`, () => {
      it(`should expose the previous exit code via $?`, async () => {
        await expectResult(bufferResult(
          `true; echo $?`,
        ), {
          stdout: `0\n`,
        });

        await expectResult(bufferResult(
          `false; echo $?`,
        ), {
          stdout: `1\n`,
        });
      });

      it(`should expose the number of arguments via $#`, async () => {
        await expectResult(bufferResult(
          `echo $#`,
        ), {
          stdout: `0\n`,
        });

        await expectResult(bufferResult(
          `echo $#`,
          [`hello`, `world`],
        ), {
          stdout: `2\n`,
        });
      });

      it(`should expose individual arguments via $0, $1, ..., $n`, async () => {
        await expectResult(bufferResult(
          `echo $0`,
          [`hello`, `world`],
        ), {
          stdout: `hello\n`,
        });

        await expectResult(bufferResult(
          `echo $1`,
          [`hello`, `world`],
        ), {
          stdout: `world\n`,
        });
      });

      it(`should support argument spread via $@`, async () => {
        await expectResult(bufferResult(
          `node -p 'JSON.stringify(process.argv.slice(1))' "$@"`,
          [`hello`, `world`],
        ), {
          stdout: `["hello","world"]\n`,
        });
      });

      it(`should expose the shell pid via $$`, async () => {
        await expectResult(bufferResult(
          `echo $$`,
        ), {
          // The shell runs in the same process as the tests
          stdout: `${process.pid}\n`,
        });
      });

      it(`should expose the shell ppid via $PPID`, async () => {
        await expectResult(bufferResult(
          `echo $PPID`,
        ), {
          // The shell runs in the same process as the tests
          stdout: `${process.ppid}\n`,
        });
      });

      it(`should support the $RANDOM variable`, async () => {
        async function getNumbers(result: Promise<{ exitCode: number, stdout: string, stderr: string }>): Promise<Array<number>> {
          const {exitCode, stdout, stderr} = await result;

          if (exitCode !== 0)
            throw new Error(stderr);

          return stdout.trim().split(/\s*\/\s*/g).map(number => Number(number));
        }

        function validateRandomNumber(number: number) {
          expect(number).toBeGreaterThanOrEqual(0);
          expect(number).toBeLessThan(32768);
        }

        let numbers = await getNumbers(bufferResult(`echo $RANDOM`));
        expect(numbers.length).toBe(1);
        numbers.forEach(validateRandomNumber);

        numbers = await getNumbers(bufferResult(`echo $RANDOM / $RANDOM / $RANDOM`));
        expect(numbers.length).toBe(3);
        numbers.forEach(validateRandomNumber);
        // There's no guarantee for this, they're random numbers after all, but the chance of this
        // occurring is 1 in 2 ** 30 or roughly 1 in 1 billion.
        expect(numbers[0] === numbers[1] && numbers[1] === numbers[2]).toBe(false);

        numbers = await getNumbers(bufferResult(`RANDOM=foo ; echo $RANDOM`));
        expect(numbers.length).toBe(1);
        numbers.forEach(validateRandomNumber);
      });

      it(`should split variables when referenced outside of quotes`, async () => {
        await expectResult(bufferResult(
          `FOO="hello world"; echo-arguments $FOO`,
        ), {
          stdout: `"hello"\n"world"\n`,
        });
      });

      it(`shouldn't turn empty variables into arguments when referenced outside of quotes`, async () => {
        await expectResult(bufferResult(
          `FOO=""; echo-arguments $FOO`,
        ), {
          stdout: ``,
        });
      });

      it(`should keep variables unified when referenced within double quotes`, async () => {
        await expectResult(bufferResult(
          `FOO="hello   world"; echo-arguments "$FOO"`,
        ), {
          stdout: `"hello   world"\n`,
        });
      });

      it(`should ignore variables when referenced within single quotes`, async () => {
        await expectResult(bufferResult(
          `FOO="hello   world"; echo-arguments '$FOO'`,
        ), {
          stdout: `"$FOO"\n`,
        });
      });

      it(`should turn empty variables into an empty argument when referenced within double quotes`, async () => {
        await expectResult(bufferResult(
          `FOO=""; echo-arguments "$FOO"`,
        ), {
          stdout: `""\n`,
        });
      });
    });

    describe(`Setting variables`, () => {
      describe(`Assignment prefix`, () => {
        it(`should set environment variables`, async () => {
          await expectResult(bufferResult(
            `PORT=1234 node -e 'process.stdout.write(process.env.PORT)'`,
          ), {
            stdout: `1234`,
          });
        });

        it(`should support setting multiple environment variables`, async () => {
          await expectResult(bufferResult(
            `HOST="localhost" PORT=1234 node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`,
          ), {
            stdout: `localhost:1234`,
          });
        });

        it(`should support setting environment variables with shell interpolation`, async () => {
          await expectResult(bufferResult(
            `HOST="local"$(echo $0) PORT=1234 node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`,
            [`host`],
          ), {
            stdout: `localhost:1234`,
          });
        });

        it(`should clear an env variable if value is omitted`, async () => {
          await expectResult(bufferResult(
            `HOST="localhost" PORT=1234 HOST= node -e 'process.stdout.write(process.env.HOST + ":" + process.env.PORT)'`,
          ), {
            stdout: `:1234`,
          });
        });

        it(`env assignment prefix syntax shouldn't persist it to the environment`, async () => {
          await expectResult(bufferResult([
            `FOO=1`,
            `FOO=2 echo hello`,
            `echo $FOO`,
          ].join(` ; `)), {
            stdout: `hello\n1\n`,
          });

          await expectResult(bufferResult([
            `FOO=1`,
            `FOO=2 echo hello`,
            `node -e 'process.stdout.write(process.env.FOO)'`,
          ].join(` ; `)), {
            stdout: `hello\n1`,
          });

          await expectResult(bufferResult(`FOO=2 echo hello ; echo $FOO`), {
            exitCode: 1,
            stdout: `hello\n`,
            stderr: `Unbound variable "FOO"\n`,
          });
        });
      });

      describe(`Assignment without command`, () => {
        it(`should support setting env variable without command`, async () => {
          await expectResult(bufferResult([
            `FOO=1`,
            `FOO=2`,
            `node -e 'process.stdout.write(process.env.FOO)'`,
          ].join(` ; `)), {
            stdout: `2`,
          });
        });

        it(`should support multiple env assignment without command`, async () => {
          await expectResult(bufferResult([
            `FOO=1 BAR=2`,
            `echo hello`,
            `echo $BAR`,
          ].join(` ; `)), {
            stdout: `hello\n2\n`,
          });
        });

        it(`should evaluate variables once before starting execution`, async () => {
          await expectResult(bufferResult([
            `FOO=1`,
            `FOO=2 echo $FOO`,
          ].join(` ; `)), {
            stdout: `1\n`,
          });
        });
      });
    });

    describe(`Using variables`, () => {
      it(`should support using environment variables`, async () => {
        await expectResult(bufferResult(
          `echo $FOOBAR`,
          [],
          {env: {FOOBAR: `hello world`}},
        ), {
          stdout: `hello world\n`,
        });
      });

      it(`should support default arguments via \${ARG:-...}`, async () => {
        await expectResult(bufferResult(
          `echo "\${DOESNT_EXIST:-hello world}"`,
        ), {
          stdout: `hello world\n`,
        });
      });

      it(`should support default arguments via \${N:-...}`, async () => {
        await expectResult(bufferResult(
          `echo "\${1:-hello world}"`,
          [],
        ), {
          stdout: `hello world\n`,
        });
      });

      it(`should support empty default arguments`, async () => {
        await expectResult(bufferResult(
          `echo "foo\${DOESNT_EXIST:-}bar"`,
        ), {
          stdout: `foobar\n`,
        });
      });

      it(`should support alternative arguments via \${ARG:+...}`, async () => {
        await expectResult(bufferResult(
          `echo "\${FOOBAR:+hello world}"`,
          [],
          {env: {FOOBAR: `goodbye world`}},
        ), {
          stdout: `hello world\n`,
        });

        await expectResult(bufferResult(
          `echo "\${FOOBAR:+hello world}"`,
        ), {
          stdout: `\n`,
        });
      });

      it(`should support alternative arguments via \${N:+...}`, async () => {
        await expectResult(bufferResult(
          `echo "\${0:+hello world}"`, [`goodbye world`],
        ), {
          stdout: `hello world\n`,
        });

        await expectResult(bufferResult(
          `echo "\${0:+hello world}"`,
        ), {
          stdout: `\n`,
        });
      });

      it(`should support alternative default arguments`, async () => {
        await expectResult(bufferResult(
          `echo "foo\${FOOBAR:+}bar"`,
          [],
          {env: {FOOBAR: `goodbye world`}},
        ), {
          stdout: `foobar\n`,
        });
      });

      describe(`Errors`, () => {
        it(`should throw recoverable errors on unbound variables`, async () => {
          await expectResult(bufferResult(
            `echo $INEXISTENT && echo OK || echo KO`,
          ), {
            exitCode: 0,
            stdout: `KO\n`,
            stderr: `Unbound variable "INEXISTENT"\n`,
          });
        });

        it(`should throw recoverable errors on unbound arguments`, async () => {
          await expectResult(bufferResult(
            `echo $42 && echo OK || echo KO`,
          ), {
            exitCode: 0,
            stdout: `KO\n`,
            stderr: `Unbound argument #42\n`,
          });
        });
      });
    });
  });

  describe(`Redirections`, () => {
    describe(`<`, () => {
      it(`should support input redirections (file)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `hello world\n`);

          await expectResult(bufferResult(
            `cat < "${file}"`,
          ), {
            stdout: `hello world\n`,
          });
        });
      });

      it(`should support input redirections to fd (file)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `hello world\n`);

          await expectResult(bufferResult(
            `cat 0< "${file}"`,
          ), {
            stdout: `hello world\n`,
          });
        });
      });

      it(`should support multiple inputs`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file1 = ppath.join(tmpDir, `file1`);
          await xfs.writeFilePromise(file1, `foo bar baz\n`);

          const file2 = ppath.join(tmpDir, `file2`);
          await xfs.writeFilePromise(file2, `hello world\n`);

          await expectResult(bufferResult(
            `cat < "${file1}" < "${file2}"`,
          ), {
            stdout: `foo bar baz\nhello world\n`,
          });
        });
      });

      it(`should throw on input redirections to unsupported file descriptors`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `hello world\n`);

          await expect(bufferResult(
            `cat 1< "${file}"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "1"`);

          await expect(bufferResult(
            `cat 2< "${file}"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "2"`);

          await expect(bufferResult(
            `cat 3< "${file}"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "3"`);
        });
      });
    });

    describe(`<<<`, () => {
      it(`should support input redirections (string)`, async () => {
        await expectResult(bufferResult(
          `cat <<< "hello world"`,
        ), {
          stdout: `hello world\n`,
        });
      });

      it(`should support input redirections to fd (string)`, async () => {
        await expectResult(bufferResult(
          `cat 0<<< "hello world"`,
        ), {
          stdout: `hello world\n`,
        });
      });

      it(`should throw on input redirections to unsupported file descriptors`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `cat 1<<< "hello world"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "1"`);

          await expect(bufferResult(
            `cat 2<<< "hello world"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "2"`);

          await expect(bufferResult(
            `cat 3<<< "hello world"`,
          )).rejects.toThrowError(`Unsupported file descriptor: "3"`);
        });
      });
    });

    describe(`>`, () => {
      it(`should support output redirections (overwrite)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file}"`,
          ), {
            stdout: ``,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
        });
      });

      it(`shouldn't affect unrelated commands`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file}"; echo foo`,
          ), {
            stdout: `foo\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
        });

        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file}" && echo foo`,
          ), {
            stdout: `foo\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
        });
      });

      it(`shouldn't do weird stuff when piping a builtin redirection`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file1 = ppath.join(tmpDir, `file1`);
          const file2 = ppath.join(tmpDir, `file2`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file1}" | echo "foo bar" > "${file2}"; echo test`,
          ), {
            stdout: `test\n`,
          });

          await expect(xfs.readFilePromise(file1, `utf8`)).resolves.toEqual(`hello world\n`);
          await expect(xfs.readFilePromise(file2, `utf8`)).resolves.toEqual(`foo bar\n`);
        });

        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file}" && echo foo`,
          ), {
            stdout: `foo\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`hello world\n`);
        });
      });

      it(`should support output redirections from fd (stdout)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `node -e "console.log(\`foo\`), console.error(\`bar\`)" 1> "${file}"`,
          ), {
            stderr: `bar\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo\n`);
        });
      });

      it(`should support output redirections from fd (stderr)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);

          await expectResult(bufferResult(
            `node -e "console.log(\`foo\`), console.error(\`bar\`)" 2> "${file}"`,
          ), {
            stdout: `foo\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`bar\n`);
        });
      });

      it(`should support multiple outputs`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file1 = ppath.join(tmpDir, `file1`);
          const file2 = ppath.join(tmpDir, `file2`);

          await expectResult(bufferResult(
            `echo "hello world" > "${file1}" > "${file2}"`,
          ), {
            stdout: ``,
          });

          await expect(xfs.readFilePromise(file1, `utf8`)).resolves.toEqual(`hello world\n`);
          await expect(xfs.readFilePromise(file2, `utf8`)).resolves.toEqual(`hello world\n`);
        });
      });

      it(`should throw on output redirections to inexistent folder`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" > "inexistent-folder/file.txt"`,
          )).rejects.toThrowError(`ENOENT: no such file or directory, open`);
        });
      });

      it(`should throw on output redirections from unsupported file descriptors`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 0> /dev/null`,
          )).rejects.toThrowError(`Unsupported file descriptor: "0"`);
        });

        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 3> /dev/null`,
          )).rejects.toThrowError(`Unsupported file descriptor: "3"`);
        });
      });
    });

    describe(`>>`, () => {
      it(`should support output redirections (append)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `foo bar baz\n`);

          await expectResult(bufferResult(
            `echo "hello world" >> "${file}"`,
          ), {
            stdout: ``,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo bar baz\nhello world\n`);
        });
      });

      it(`should support output redirections from fd (stdout)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `foo bar baz\n`);

          await expectResult(bufferResult(
            `node -e "console.log(\`foo\`), console.error(\`bar\`)" 1>> "${file}"`,
          ), {
            stderr: `bar\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo bar baz\nfoo\n`);
        });
      });

      it(`should support output redirections from fd (stderr)`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const file = ppath.join(tmpDir, `file`);
          await xfs.writeFilePromise(file, `foo bar baz\n`);

          await expectResult(bufferResult(
            `node -e "console.log(\`foo\`), console.error(\`bar\`)" 2>> "${file}"`,
          ), {
            stdout: `foo\n`,
          });

          await expect(xfs.readFilePromise(file, `utf8`)).resolves.toEqual(`foo bar baz\nbar\n`);
        });
      });

      it(`should throw on output redirections from unsupported file descriptors`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 0>> /dev/null`,
          )).rejects.toThrowError(`Unsupported file descriptor: "0"`);
        });

        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 3>> /dev/null`,
          )).rejects.toThrowError(`Unsupported file descriptor: "3"`);
        });
      });
    });

    describe(`>&`, () => {
      it(`should support implicit stdout redirections (file descriptor)`, async () => {
        await expectResult(bufferResult(
          `echo "hello world" >& 1`,
        ), {
          stdout: `hello world\n`,
        });

        await expectResult(bufferResult(
          `echo "hello world" >& 2`,
        ), {
          stderr: `hello world\n`,
        });
      });

      it(`should support stdout redirections (file descriptor)`, async () => {
        await expectResult(bufferResult(
          `echo "hello world" 1>& 1`,
        ), {
          stdout: `hello world\n`,
        });

        await expectResult(bufferResult(
          `echo "hello world" 1>& 2`,
        ), {
          stderr: `hello world\n`,
        });
      });

      it(`should support stderr redirections (file descriptor)`, async () => {
        await expectResult(bufferResult(
          `node -e "console.error(\`hello world\`)" 2>& 1`,
        ), {
          stdout: `hello world\n`,
        });

        await expectResult(bufferResult(
          `node -e "console.error(\`hello world\`)" 2>& 2`,
        ), {
          stderr: `hello world\n`,
        });
      });

      it(`should support multiple stdout redirections (file descriptor)`, async () => {
        await expectResult(bufferResult(
          `echo "hello world" >& 1 >& 2`,
        ), {
          stdout: `hello world\n`,
          stderr: `hello world\n`,
        });
      });

      it(`should throw on output redirections from unsupported file descriptors`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 0>& 1`,
          )).rejects.toThrowError(`Unsupported file descriptor: "0"`);
        });

        await xfs.mktempPromise(async tmpDir => {
          await expect(bufferResult(
            `echo "hello world" 3>& 1`,
          )).rejects.toThrowError(`Unsupported file descriptor: "3"`);
        });
      });

      it(`should throw recoverable errors when a bad file descriptor is encountered`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expectResult(bufferResult(
            `echo "hello world" >& 42 && echo OK || echo KO`,
            [],
            {cwd: tmpDir},
          ), {
            exitCode: 0,
            stdout: `KO\n`,
            stderr: `Bad file descriptor: "42"\n`,
          });
        });
      });
    });
  });

  describe(`Pipelines`, () => {
    describe(`|`, () => {
      it(`should pipe the result of a command into another (two commands, builtin into native)`, async () => {
        await expectResult(bufferResult([
          `echo hello world`,
          `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
        ].join(` | `)), {
          stdout: `HELLO WORLD\n`,
        });
      });

      it(`should pipe the result of a command into another (two commands, native into pipe)`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stdout.write("abcdefgh\\n");'`,
          `test-builtin`,
        ].join(` | `)), {
          stdout: `aceg\n`,
        });
      });

      it(`should pipe the result of a command into another (three commands)`, async () => {
        await expectResult(bufferResult([
          `echo hello world`,
          `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
          `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().replace(/./g, $0 => \`{\${$0}}\`)))'`,
        ].join(` | `)), {
          stdout: `{H}{E}{L}{L}{O}{ }{W}{O}{R}{L}{D}\n`,
        });
      });

      it(`should pipe the result of a command into another (no builtins)`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stdout.write("hello world\\n")'`,
          `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().toUpperCase()))'`,
          `node -e 'process.stdin.on("data", data => process.stdout.write(data.toString().replace(/./g, $0 => \`{\${$0}}\`)))'`,
        ].join(` | `)), {
          stdout: `{H}{E}{L}{L}{O}{ }{W}{O}{R}{L}{D}\n`,
        });
      });

      it(`should pipe the result of a command into another (only builtins)`, async () => {
        await expectResult(bufferResult([
          `echo abcdefghijkl`,
          `test-builtin`,
          `test-builtin`,
        ].join(` | `)), {
          stdout: `aei\n`,
        });
      });

      it(`should pipe the stdout of a command into another`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stdout.write("Hello World");'`,
          `echo-stdin`,
        ].join(` | `)), {
          stdout: `Hello World\n`,
        });
      });

      it(`shouldn't pipe the stderr of a command into another`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stderr.write("Hello World");'`,
          `echo-stdin`,
        ].join(` | `)), {
          stdout: `\n`,
          stderr: `Hello World`,
        });
      });
    });

    describe(`|&`, () => {
      it(`should pipe the stdout of a command into another`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stdout.write("Hello World");'`,
          `echo-stdin`,
        ].join(` |& `)), {
          stdout: `Hello World\n`,
        });
      });

      it(`should pipe the stderr of a command into another`, async () => {
        await expectResult(bufferResult([
          `node -e 'process.stderr.write("Hello World");'`,
          `echo-stdin`,
        ].join(` |& `)), {
          stdout: `Hello World\n`,
        });
      });
    });

    describe(`>`, () => {
      it(`should support redirecting to /dev/null`, async () => {
        await expectResult(bufferResult(`(echo foo > /dev/null) && echo bar`), {
          stdout: `bar\n`,
        });
      });
    });

    describe(`>>`, () => {
      it(`should support redirecting to /dev/null`, async () => {
        await expectResult(bufferResult(`(echo foo >> /dev/null) && echo bar`), {
          stdout: `bar\n`,
        });
      });
    });
  });

  describe(`Lists`, () => {
    it(`should execute lists with left associativity`, async () => {
      await expectResult(bufferResult(
        `false && echo yes || echo no`,
      ), {
        exitCode: 0,
        stdout: `no\n`,
        stderr: ``,
      });

      await expectResult(bufferResult(
        `false || echo no && echo yes`,
      ), {
        exitCode: 0,
        stdout: `no\nyes\n`,
        stderr: ``,
      });

      await expectResult(bufferResult(
        `false && echo yes || false && echo yes || echo no`,
      ), {
        exitCode: 0,
        stdout: `no\n`,
        stderr: ``,
      });
    });
  });

  describe(`Glob support`, () => {
    describe(`Syntax`, () => {
      describe(`Basic Syntax`, () => {
        it(`should support glob patterns with asterisk`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `b.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `c.txt`), ``);

            await expectResult(bufferResult(
              `echo *`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txt b.txt c.txt\n`,
            });

            await expectResult(bufferResult(
              `echo *.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txt b.txt c.txt\n`,
            });
          });
        });

        it(`should support glob patterns with globstar`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.mkdirpPromise(ppath.join(tmpDir, `foo/bar`));

            await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo/b.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo/bar/c.txt`), ``);

            await expectResult(bufferResult(
              `echo **`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txt foo foo/b.txt foo/bar foo/bar/c.txt\n`,
            });

            await expectResult(bufferResult(
              `echo **/*.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txt foo/b.txt foo/bar/c.txt\n`,
            });
          });
        });

        it(`should support glob patterns with question mark`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `ax.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `axxa.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `a.txtx`), ``);

            await expectResult(bufferResult(
              `echo a?.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `ax.txt\n`,
            });

            await expectResult(bufferResult(
              `echo a??a.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `axxa.txt\n`,
            });

            await expectResult(bufferResult(
              `echo a.txt?`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txtx\n`,
            });
          });
        });

        it(`should support glob patterns with sequence`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `a1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `a2.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `a3.txt`), ``);

            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.js`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.ts`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.cs`), ``);

            await expectResult(bufferResult(
              `echo a[23].txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a2.txt a3.txt\n`,
            });

            await expectResult(bufferResult(
              `echo foo.[jt]s`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `foo.js foo.ts\n`,
            });

            await expectResult(bufferResult(
              `echo foo.[!jt]s`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `foo.cs\n`,
            });

            await expectResult(bufferResult(
              `echo foo.[^jt]s`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `foo.cs\n`,
            });
          });
        });

        // This test worked before, but it worked by mistake. Even though escape
        // characters were used, the arguments were still interpreted as glob patterns.
        // The actual problem is that our shell doesn't support escaping correctly.

        //   it(`should support glob patterns with escape characters`, async () => {
        //     await xfs.mktempPromise(async tmpDir => {
        //       await expectResult(bufferResult(
        //         `echo a\\*b.txt`,
        //         [],
        //         {cwd: tmpDir}
        //       ), {
        //         stdout: `a*b.txt\n`,
        //       });

        //       await expectResult(bufferResult(
        //         `echo a\\?b.txt`,
        //         [],
        //         {cwd: tmpDir}
        //       ), {
        //         stdout: `a?b.txt\n`,
        //       });

        //       await expectResult(bufferResult(
        //         `echo a\\{c,d}b.txt`,
        //         [],
        //         {cwd: tmpDir}
        //       ), {
        //         stdout: `a{c,d}b.txt\n`,
        //       });
        //     });
        //   });
      });

      describe(`Advanced Syntax`, () => {
        it(`should support glob patterns with posix character classes`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `abc.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `123.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo123.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `BAR.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `hello_world123.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `&434)hello.txt`), ``);

            // TODO: Remove the condition once Node is fixed:
            // https://github.com/nodejs/node/issues/48673
            if (process.platform !== `win32`)
              await xfs.writeFilePromise(ppath.join(tmpDir, `😀.txt`), ``);

            await expectResult(bufferResult(
              `echo +([[:alnum:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `123.txt BAR.txt abc.txt foo.txt foo123.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:alpha:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `BAR.txt abc.txt foo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:ascii:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `&434)hello.txt 123.txt BAR.txt abc.txt foo.txt foo123.txt hello_world123.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:digit:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `123.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:lower:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `abc.txt foo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:upper:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `BAR.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:word:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `123.txt BAR.txt abc.txt foo.txt foo123.txt hello_world123.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([[:xdigit:]]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `123.txt abc.txt\n`,
            });
          });
        });

        it(`should support glob patterns with extglobs`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `f.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fo.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooo.txt`), ``);

            await expectResult(bufferResult(
              `echo f@(o).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `fo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo f*(o).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `f.txt fo.txt foo.txt fooo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo f+(o).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `fo.txt foo.txt fooo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo f?(o).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `f.txt fo.txt\n`,
            });

            await expectResult(bufferResult(
              `echo f!(o).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `f.txt\n`,
            });
          });
        });

        it(`should support glob patterns with braces`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `b.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `c.txt`), ``);

            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.js`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.ts`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `foo.vue`), ``);

            await xfs.writeFilePromise(ppath.join(tmpDir, `cbaxbc.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `cbstbc.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `ftaxwy.txt`), ``);

            await xfs.writeFilePromise(ppath.join(tmpDir, `abc.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `acd.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `ade.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `aef.txt`), ``);

            await expectResult(bufferResult(
              `echo {a,b}.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `a.txt b.txt\n`,
            });

            await expectResult(bufferResult(
              `echo {cb,ft}{ax,st}{bc,wy}.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `cbaxbc.txt cbstbc.txt ftaxwy.txt\n`,
            });

            await expectResult(bufferResult(
              `echo a{bc,{cd,{de,ef}}}.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `abc.txt acd.txt ade.txt aef.txt\n`,
            });
          });
        });

        it(`should support glob patterns with regexp character classes`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `abcd.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `abcdxyz.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `12345.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `0123456789.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `abcdxyz0123456789.txt`), ``);

            await expectResult(bufferResult(
              `echo +([a-d]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `abcd.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([1-5]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `12345.txt\n`,
            });

            await expectResult(bufferResult(
              `echo +([a-d])+([x-z])+([0-9]).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `abcdxyz0123456789.txt\n`,
            });
          });
        });

        it(`should support glob patterns with regexp groups`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await xfs.writeFilePromise(ppath.join(tmpDir, `ab12.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `pq56.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `xy89.txt`), ``);

            await xfs.writeFilePromise(ppath.join(tmpDir, `foox1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooxa1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooxb1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooy1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooya1.txt`), ``);
            await xfs.writeFilePromise(ppath.join(tmpDir, `fooyb1.txt`), ``);

            await expectResult(bufferResult(
              `echo (ab|xy)(12|89).txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `ab12.txt xy89.txt\n`,
            });

            await expectResult(bufferResult(
              `echo foo(x!(a)|y!(b))1.txt`,
              [],
              {cwd: tmpDir},
            ), {
              stdout: `foox1.txt fooxb1.txt fooy1.txt fooya1.txt\n`,
            });
          });
        });
      });
    });

    describe(`Functionality`, () => {
      describe(`Errors`, () => {
        it(`should throw recoverable errors when no matches are found`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await expectResult(bufferResult(
              `echo * && echo OK || echo KO`,
              [],
              {cwd: tmpDir},
            ), {
              exitCode: 0,
              stdout: `KO\n`,
              stderr: `No matches found: "*"\n`,
            });
          });
        });

        it(`should include a brace expansion notice when no matches are found for a brace expansion pattern`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await expectResult(bufferResult(
              `echo {foo,bar}`,
              [],
              {cwd: tmpDir},
            ), {
              exitCode: 1,
              stdout: ``,
              stderr: expect.stringContaining(`Note: Brace expansion of arbitrary strings isn't currently supported. For more details, please read this issue: https://github.com/yarnpkg/berry/issues/22`),
            });
          });
        });

        it(`should not include a brace expansion notice when no matches are found for a non-brace expansion pattern`, async () => {
          await xfs.mktempPromise(async tmpDir => {
            await expectResult(bufferResult(
              `echo *`,
              [],
              {cwd: tmpDir},
            ), {
              exitCode: 1,
              stdout: ``,
              stderr: expect.not.stringContaining(`Note: Brace expansion of arbitrary strings isn't currently supported. For more details, please read this issue: https://github.com/yarnpkg/berry/issues/22`),
            });
          });
        });
      });

      it(`should include directories`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(ppath.join(tmpDir, `a.txt`), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `b.txt`), ``);
          await xfs.writeFilePromise(ppath.join(tmpDir, `c.txt`), ``);

          await xfs.mkdirPromise(ppath.join(tmpDir, `d`));
          await xfs.mkdirPromise(ppath.join(tmpDir, `e`));

          await expectResult(bufferResult(
            `echo *`,
            [],
            {cwd: tmpDir},
          ), {
            stdout: `a.txt b.txt c.txt d e\n`,
          });
        });
      });
    });

    describe(`Integrations`, () => {
      it(`should work with environment variables`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const subdir = ppath.join(tmpDir, `subdir`);
          await xfs.mkdirPromise(subdir);

          await xfs.writeFilePromise(ppath.join(subdir, `a.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `b.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `c.txt`), ``);

          await expectResult(bufferResult(
            `echo $DIRNAME/*`,
            [],
            {cwd: tmpDir, env: {DIRNAME: `subdir`}},
          ), {
            stdout: `subdir/a.txt subdir/b.txt subdir/c.txt\n`,
          });

          await expectResult(bufferResult(
            `echo \${DIRNAME}/*`,
            [],
            {cwd: tmpDir, env: {DIRNAME: `subdir`}},
          ), {
            stdout: `subdir/a.txt subdir/b.txt subdir/c.txt\n`,
          });
        });
      });

      it(`should work with subshells`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const subdir = ppath.join(tmpDir, `subdir`);
          await xfs.mkdirPromise(subdir);

          await xfs.writeFilePromise(ppath.join(subdir, `a.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `b.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `c.txt`), ``);

          await expectResult(bufferResult(
            `echo $(echo subdir)/*`,
            [],
            {cwd: tmpDir, env: {DIRNAME: `subdir`}},
          ), {
            stdout: `subdir/a.txt subdir/b.txt subdir/c.txt\n`,
          });
        });
      });

      it(`should work with arithmetics`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          const subdir = ppath.join(tmpDir, `1234`);
          await xfs.mkdirPromise(subdir);

          await xfs.writeFilePromise(ppath.join(subdir, `a.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `b.txt`), ``);
          await xfs.writeFilePromise(ppath.join(subdir, `c.txt`), ``);

          await expectResult(bufferResult(
            `echo $(( 1000 + 234 ))/*`,
            [],
            {cwd: tmpDir},
          ), {
            stdout: `1234/a.txt 1234/b.txt 1234/c.txt\n`,
          });
        });
      });
    });
  });

  describe(`Calculations`, () => {
    it(`should support integers`, async () => {
      await expectResult(bufferResult(
        `echo $(( 1 ))`,
      ), {
        exitCode: 0,
        stdout: `1\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 134 ))`,
      ), {
        exitCode: 0,
        stdout: `134\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 5693 ))`,
      ), {
        exitCode: 0,
        stdout: `5693\n`,
      });

      await expect(bufferResult(
        `echo $(( 5.93 ))`,
      )).rejects.toThrowError(/Invalid number: "5\.93", only integers are allowed/);
    });

    it(`should support operations`, async () => {
      await expectResult(bufferResult(
        `echo $(( 1 + 2 -4 ))`,
      ), {
        exitCode: 0,
        stdout: `-1\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 134 / 3 ))`,
      ), {
        exitCode: 0,
        stdout: `44\n`,
      });

      await expectResult(bufferResult(
        `echo $(( -134 / 3 ))`,
      ), {
        exitCode: 0,
        stdout: `-44\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 4 * (2 + 3) * 5 ))`,
      ), {
        exitCode: 0,
        stdout: `100\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 4 * 2 + 3 * 5 ))`,
      ), {
        exitCode: 0,
        stdout: `23\n`,
      });
    });

    it(`should have left associativity`, async () => {
      await expectResult(bufferResult(
        `echo $(( 7 - 2 - 3 ))`,
      ), {
        exitCode: 0,
        stdout: `2\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 32 / 4 / 8 ))`,
      ), {
        exitCode: 0,
        stdout: `1\n`,
      });

      await expectResult(bufferResult(
        `echo $(( 32 + 64 * 2 / 4 / 8 - 9 ))`,
      ), {
        exitCode: 0,
        stdout: `27\n`,
      });
    });

    it(`should support arguments`, async () => {
      await expectResult(bufferResult(
        `echo $(( $0 + 2 ))`,
        [`3`],
      ), {
        exitCode: 0,
        stdout: `5\n`,
      });

      await expectResult(bufferResult(
        `echo $(( $0 / $1 ))`,
        [`9`, `3`],
      ), {
        exitCode: 0,
        stdout: `3\n`,
      });
    });

    it(`should support variables and env`, async () => {
      const opts = {
        variables: {
          three: `3`,
          four: `4`,
          notDeepEnough: `four`,
          isThisDeepEnough: `notDeepEnough`,
        },
        env: {
          one: `1`,
          two: `2`,
        },
      };

      await expectResult(bufferResult(
        `echo $(( $three + 2 ))`,
        [],
        opts,
      ), {
        exitCode: 0,
        stdout: `5\n`,
      });

      await expectResult(bufferResult(
        `echo $(( $four * $two ))`,
        [],
        opts,
      ), {
        exitCode: 0,
        stdout: `8\n`,
      });

      await expectResult(bufferResult(
        `echo $(( three + one ))`,
        [],
        opts,
      ), {
        exitCode: 0,
        stdout: `4\n`,
      });

      await expectResult(bufferResult(
        `echo $((isThisDeepEnough+ one))`,
        [],
        opts,
      ), {
        exitCode: 0,
        stdout: `5\n`,
      });
    });
  });

  describe(`Background jobs`, () => {
    it(`should provide color-coded prefixed output and color-coded "Job has ended" message inside TTYs`, async () => {
      const {stdout, stderr, exitCode} = await bufferResult(`echo foo & echo bar`, [], {tty: true});

      expect(stripAnsi(stdout)).toContain(`Job [1], 'echo foo' has ended`);
      expect(stripAnsi(stdout)).toContain(`[1] foo`);

      expect(stripAnsi(stderr)).toStrictEqual(``);
      expect(exitCode).toStrictEqual(0);
    });

    it(`should provide the raw output when piped`, async () => {
      const {stdout, stderr, exitCode} = await bufferResult(`echo foo & echo bar`, [], {tty: false});

      expect(stripAnsi(stdout)).toStrictEqual(stdout);
      expect(stripAnsi(stdout)).not.toContain(`Job [1], 'echo foo' has ended`);
      expect(stripAnsi(stdout)).not.toContain(`[1] foo`);

      expect(stripAnsi(stderr)).toStrictEqual(``);
      expect(exitCode).toStrictEqual(0);
    });

    it(`should print errors to stderr and always exit with exit code 0`, async () => {
      const {stdout, stderr, exitCode} = await bufferResult(`echo $THIS_VARIABLE_DOES_NOT_EXIST &`, [], {tty: true});

      expect(stripAnsi(stdout)).toContain(`Job [1], 'echo \${THIS_VARIABLE_DOES_NOT_EXIST}' has ended`);
      expect(stripAnsi(stderr)).toContain(`[1] Unbound variable "THIS_VARIABLE_DOES_NOT_EXIST"`);
      expect(exitCode).toStrictEqual(0);
    });

    it(`should wait for all background jobs to finish before resolving`, async () => {
      await expect(Promise.race([
        bufferResult(`sleep 0.4 && echo foo`, [], {tty: false}),
        setTimeout(300),
      ])).resolves.toBeUndefined();

      await expectResult(Promise.race([
        bufferResult(`sleep 0.4 && echo foo`, [], {tty: false}),
        setTimeout(500),
      ]), {
        stdout: `foo\n`,
        stderr: ``,
        exitCode: 0,
      });

      await expect(Promise.race([
        bufferResult(`sleep 0.4 & echo foo`, [], {tty: false}),
        setTimeout(300),
      ])).resolves.toBeUndefined();

      await expectResult(Promise.race([
        bufferResult(`sleep 0.4 & echo foo`, [], {tty: false}),
        setTimeout(500),
      ]), {
        stdout: `foo\n`,
        stderr: ``,
        exitCode: 0,
      });
    });
  });

  describe(`Builtins`, () => {
    describe(`cd`, () => {
      it(`should throw recoverable errors when the target is not a directory`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await xfs.writeFilePromise(`${tmpDir}/file` as PortablePath, ``);

          await expectResult(bufferResult(
            `cd file && echo OK || echo KO`,
            [],
            {cwd: tmpDir},
          ), {
            exitCode: 0,
            stdout: `KO\n`,
            stderr: `cd: not a directory: file\n`,
          });
        });
      });

      it(`should throw recoverable errors when the target does not exist`, async () => {
        await xfs.mktempPromise(async tmpDir => {
          await expectResult(bufferResult(
            `cd doesnt-exist && echo OK || echo KO`,
            [],
            {cwd: tmpDir},
          ), {
            exitCode: 0,
            stdout: `KO\n`,
            stderr: `cd: no such file or directory: doesnt-exist\n`,
          });
        });
      });
    });

    describe(`sleep`, () => {
      it(`should throw recoverable errors when the operand is missing`, async () => {
        await expectResult(bufferResult(
          `sleep && echo OK || echo KO`,
        ), {
          exitCode: 0,
          stdout: `KO\n`,
          stderr: `sleep: missing operand\n`,
        });
      });

      it(`should throw recoverable errors when the operand is an invalid time interval`, async () => {
        await expectResult(bufferResult(
          `sleep invalid && echo OK || echo KO`,
        ), {
          exitCode: 0,
          stdout: `KO\n`,
          stderr: `sleep: invalid time interval 'invalid'\n`,
        });
      });
    });

    describe(`unset`, () => {
      it(`should unset one variable`, async () => {
        await expectResult(bufferResult(
          `FOO=bar; unset FOO; echo $FOO`,
        ), {
          exitCode: 1,
          stderr: `Unbound variable "FOO"\n`,
        });
      });

      it(`should unset multiple variables`, async () => {
        await expectResult(bufferResult(
          `A=1 B=2; unset A B; echo $A; echo $B`,
        ), {
          exitCode: 1,
          stderr: `Unbound variable "A"\nUnbound variable "B"\n`,
        });
      });
    });
  });
});
