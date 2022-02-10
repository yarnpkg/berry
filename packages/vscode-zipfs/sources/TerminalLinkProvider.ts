import {npath}     from '@yarnpkg/fslib';
import * as vscode from 'vscode';

type Link = vscode.TerminalLink & { data: string };

/**
 * Regex patterns to match line and columns in filepaths
 */
const SELECTOR_PATTERNS = [
  // :LINE:COLUMN
  /:(\d+):(\d+)/,

  // :LINE
  /:(\d+)/,

  // (LINE,COLUMN)
  /\((\d+),(\d+)\)/,

  // (LINE)
  /\((\d+)\)/,
];

const COMBINED_SELECTORS = SELECTOR_PATTERNS.map(selector => `(${selector.source})`).join(`|`);
const FILEPATH_MATCHER = /(([A-Za-z]:)?\/.*((__virtual__)|(\$\$virtual)|(\.zip)).*\.[\w:]+)/.source;

const FILE_SELECTOR_MATCHER = `(${FILEPATH_MATCHER})(${COMBINED_SELECTORS})?`;

export function registerTerminalLinkProvider() {
  const terminalProvider: vscode.TerminalLinkProvider<Link> = {
    provideTerminalLinks(context) {
      const linkResult: Array<Link> = [];

      const line = context.line.replace(/\\/g, `/`);

      const matcher = new RegExp(FILE_SELECTOR_MATCHER, `gm`);

      let match: RegExpExecArray | null = null;
      while ((match = matcher.exec(line))) {
        const [filepath] = match;

        if (npath.isAbsolute(filepath)) {
          linkResult.push({
            startIndex: match.index,
            length: filepath.length,
            tooltip: `Open file in editor (ZipFS)`,
            data: filepath,
          });
        }
      }

      return linkResult;
    },

    async handleTerminalLink(link) {
      let selection: vscode.Range | undefined = undefined;
      let matchIndex: number | undefined = undefined;

      for (const pattern of SELECTOR_PATTERNS) {
        const match = link.data.match(pattern);
        if (match) {
          const [, line, column] = match;
          const startLine = Math.max(Number(line ?? 0) - 1, 0);
          const startColumn = Math.max(Number(column ?? 0) - 1, 0);

          selection = new vscode.Range(startLine, startColumn, startLine, startColumn);
          matchIndex = match.index;
          break;
        }
      }

      await vscode.window.showTextDocument(
        vscode.Uri.parse(`zip:${link.data.substring(0, matchIndex).replace(/^\/?/, `/`)}`),
        {
          selection,
        },
      );
    },
  };

  return vscode.window.registerTerminalLinkProvider(terminalProvider);
}
