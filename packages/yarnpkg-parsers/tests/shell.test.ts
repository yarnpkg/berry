import {parseShell, stringifyShell} from '../sources';

const VALID_COMMANDS = [
  `echo {`,
  `echo {foo`,
  `echo { foo`,
  `echo {}`,
  `echo foo{}bar`,

  // It should allow shell lines to end with semicolons
  `echo foo;`,

  // Redirections
  ...[
    `echo foo >& 1`,
    `echo foo >&1`,
    `echo foo 2> bar`,
  ],

  // Groups
  ...[
    // Parsable by bash
    `{ echo foo; }`,
    `{ echo foo;}`,

    // Unparsable by bash, parsable by zsh
    `{ echo foo }`,
    `{echo foo }`,
    `{ echo foo}`,
    `{echo foo}`,
  ],

  // Background jobs
  // "&" should have the same precedence as ";"
  ...[
    `echo foo &`,
    `echo foo & echo bar`,
    `echo foo & echo bar &`,
    `echo foo && echo bar &`,
    `echo foo; echo bar &`,
    `sleep 3 && echo foo & echo bar`,
    `echo foo | wc --chars &`,
    `echo foo | wc --chars & echo bar`,
  ],
];

const INVALID_COMMANDS = [
  // Empty shell lines
  ...[
    // Only fish supports these
    `;;`,
    `echo foo;;`,
    // Only zsh and fish support these
    `; ;`,
    `echo foo; ;`,
  ],

  `echo }`,
  `echo foo}`,

  // It shouldn't allow shell lines to start with semicolons.
  // Bash doesn't allow it, but ZSH and Fish do. We don't, because
  // we don't need the extra complexity. Also, it's more common to
  // end a shell line with a semicolon, rather than start one with a semicolon.
  // Anyways, I can't think of any reason why anybody would like to start
  // a script with a semicolon. ¯\_(ツ)_/¯.
  `; echo foo`,

  `& echo foo`,
];


const DOUBLE_QUOTE_STRING_ESCAPE_TESTS: Array<[string, string]> = [
  [`\\\n`, ``],
  [`\\\\`, `\\`],
  [`\\"`, `"`],
  [`\\$`, `$`],
];

const ANSI_C_STRING_ESCAPE_TESTS: Array<[string, string]> = [
  [`\\\\`, `\\`],
  [`\\"`, `"`],
  [`\\'`, `'`],
  [`\\e`, `\x1b`],
  [`\\0`, `\x00`],
  [`\\x7`, `\x07`],
  [`\\u0027`, `'`],
  [`\\U0001F601`, `😁`],
];

describe(`Shell parser`, () => {
  describe(`Valid commands`, () => {
    for (const command of VALID_COMMANDS) {
      it(`should parse "${command}"`, () => {
        expect(() => parseShell(command)).not.toThrow();
      });
    }
  });

  describe(`Invalid commands`, () => {
    for (const command of INVALID_COMMANDS) {
      it(`shouldn't parse "${command}"`, () => {
        expect(() => parseShell(command)).toThrow();
      });
    }
  });

  describe(`Redirections`, () => {
    describe(`fd`, () => {
      it(`shouldn't parse fds that aren't single digits as part of the redirection`, () => {
        expect(parseShell(`echo 10> /dev/null`)).toStrictEqual([expect.objectContaining({
          command: expect.objectContaining({
            chain: expect.objectContaining({
              args: [
                expect.anything(),
                {type: `argument`, segments: [{type: `text`, text: `10`}]},
                expect.objectContaining({fd: null}),
              ],
            }),
          }),
        })]);
      });

      it(`shouldn't parse fds that aren't directly next to the redirection as part of the redirection`, () => {
        expect(parseShell(`echo 1 > /dev/null`)).toStrictEqual([expect.objectContaining({
          command: expect.objectContaining({
            chain: expect.objectContaining({
              args: [
                expect.anything(),
                {type: `argument`, segments: [{type: `text`, text: `1`}]},
                expect.objectContaining({fd: null}),
              ],
            }),
          }),
        })]);
      });
    });
  });

  describe(`Strings`, () => {
    it(`should parse double quoted strings correctly`, () => {
      for (const [original, raw] of DOUBLE_QUOTE_STRING_ESCAPE_TESTS) {
        expect(parseShell(`echo "${original}"`)).toStrictEqual([expect.objectContaining({
          command: expect.objectContaining({
            chain: expect.objectContaining({
              args: [
                expect.anything(),
                {type: `argument`, segments: [{type: `text`, text: raw}]},
              ],
            }),
          }),
        })]);
      }
    });

    it(`should parse ANSI-C strings correctly`, () => {
      for (const [original, raw] of ANSI_C_STRING_ESCAPE_TESTS) {
        expect(parseShell(`echo $'${original}'`)).toStrictEqual([expect.objectContaining({
          command: expect.objectContaining({
            chain: expect.objectContaining({
              args: [
                expect.anything(),
                {type: `argument`, segments: [{type: `text`, text: raw}]},
              ],
            }),
          }),
        })]);
      }
    });
  });
});

const STRINGIFIER_TESTS: Array<[string, string]> = [
  [`echo foo`, `echo foo`],
  [`echo parapapa`, `echo parapapa`],
  [`echo 'foo bar'`, `echo 'foo bar'`],
  [`echo "foo' bar'"`, `echo "foo' bar'"`],
  [`echo foo; echo bar`, `echo foo; echo bar`],
  [`echo foo; echo bar;`, `echo foo; echo bar`],
  [`echo foo &`, `echo foo &`],
  [`echo foo & echo bar`, `echo foo & echo bar`],
  [`echo foo & echo bar &`, `echo foo & echo bar &`],
  [`echo foo && echo bar || echo baz`, `echo foo && echo bar || echo baz`],
  [`echo foo | wc --chars`, `echo foo | wc --chars`],
  [`ls **/foo/*.txt`, `ls **/foo/*.txt`],
  [`echo foo > bar`, `echo foo > bar`],
  [`echo a$B"c"'d'`, `echo a\${B}cd`],
  [`echo a$B"c"'d'`, `echo a\${B}cd`],
  [`echo $(echo a)`, `echo $(echo a)`],
  [`echo $(( 1 + 2 * 3 - 4 / 5 ))`, `echo $(( ( 1 + ( 2 * 3 ) ) - ( 4 / 5 ) ))`],
  [`echo $(( 7 - 2 - 3 * 5 / 6 ))`, `echo $(( ( 7 - 2 ) - ( ( 3 * 5 ) / 6 ) ))`],
  [`(echo foo && echo bar)`, `(echo foo && echo bar)`],
  [`{echo foo && echo bar}`, `{ echo foo && echo bar; }`],
  [`FOO=bar echo foo`, `FOO=bar echo foo`],
  [`FOO=bar BAZ=qux`, `FOO=bar BAZ=qux`],
  [`FOO=$'\\x09'`, `FOO=$'\\t'`],
  [`FOO=$'\\u0027'`, `FOO="'"`],
  [`FOO=$'\\U0001F601'`, `FOO=😁`],
];

describe(`Shell stringifier`, () => {
  for (const [original, prettyPrinted] of STRINGIFIER_TESTS) {
    it(`should pretty print '${original}' as '${prettyPrinted}'`, () => {
      expect(stringifyShell(parseShell(original))).toStrictEqual(prettyPrinted);
    });
  }
});
