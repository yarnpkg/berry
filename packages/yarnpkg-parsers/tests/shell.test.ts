import {parseShell} from '../sources';

const VALID_COMMANDS = [
  // It should allow shell lines to end with semicolons
  `echo foo;`,

  // Redirections
  ...[
    `echo foo >& 1`,
    `echo foo >&1`,
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
  // It shouldn't allow shell lines to start with semicolons.
  // Bash doesn't allow it, but ZSH and Fish do. We don't, because
  // we don't need the extra complexity. Also, it's more common to
  // end a shell line with a semicolon, rather than start one with a semicolon.
  // Anyways, I can't think of any reason why anybody would like to start
  // a script with a semicolon. ¯\_(ツ)_/¯.
  `; echo foo`,

  `& echo foo`,
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
});
