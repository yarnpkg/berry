import {miscUtils}                           from '@yarnpkg/core';
import {FakeFS, ppath, NodeFS, PortablePath} from '@yarnpkg/fslib';

import {ParsedPatchFile, FilePatch, Hunk}    from './parse';

const DEFAULT_TIME = 315532800;

async function preserveTime(baseFs: FakeFS<PortablePath>, p: PortablePath, cb: () => Promise<PortablePath | void>) {
  const stat = await baseFs.lstatPromise(p);

  const result = await cb();
  if (typeof result !== `undefined`)
    p = result;

  if (baseFs.lutimesPromise) {
    await baseFs.lutimesPromise(p, stat.atime, stat.mtime);
  } else if (!stat.isSymbolicLink()) {
    await baseFs.utimesPromise(p, stat.atime, stat.mtime);
  } else {
    throw new Error(`Cannot preserve the time values of a symlink`);
  }
}

export async function applyPatchFile(effects: ParsedPatchFile, {baseFs = new NodeFS(), dryRun = false}: {baseFs?: FakeFS<PortablePath>, dryRun?: boolean} = {}) {
  for (const eff of effects) {
    switch (eff.type) {
      case `file deletion`: {
        if (dryRun) {
          if (!baseFs.existsSync(eff.path)) {
            throw new Error(`Trying to delete file that doesn't exist: ${eff.path}`);
          }
        } else {
          await preserveTime(baseFs, ppath.dirname(eff.path), async () => {
            await baseFs.unlinkPromise(eff.path);
          });
        }
      } break;

      case `rename`: {
        if (dryRun) {
          if (!baseFs.existsSync(eff.fromPath)) {
            throw new Error(`Trying to move file that doesn't exist: ${eff.fromPath}`);
          }
        } else {
          await preserveTime(baseFs, ppath.dirname(eff.fromPath), async () => {
            await preserveTime(baseFs, ppath.dirname(eff.toPath), async () => {
              await preserveTime(baseFs, eff.fromPath, async () => {
                await baseFs.movePromise(eff.fromPath, eff.toPath);
                return eff.toPath;
              });
            });
          });
        }
      } break;

      case `file creation`: {
        if (dryRun) {
          if (baseFs.existsSync(eff.path)) {
            throw new Error(`Trying to create file that already exists: ${eff.path}`);
          }
        } else {
          const fileContents = eff.hunk
            ? eff.hunk.parts[0].lines.join(`\n`) + (eff.hunk.parts[0].noNewlineAtEndOfFile ? `` : `\n`)
            : ``;

          // Todo: the parent of the first directory thus created will still see its mtime changed
          await baseFs.mkdirpPromise(ppath.dirname(eff.path), {chmod: 0o755, utimes: [DEFAULT_TIME, DEFAULT_TIME]});

          await baseFs.writeFilePromise(eff.path, fileContents, {mode: eff.mode});
          await baseFs.utimesPromise(eff.path, DEFAULT_TIME, DEFAULT_TIME);
        }
      } break;

      case `patch`: {
        await preserveTime(baseFs, eff.path, async () => {
          await applyPatch(eff, {baseFs, dryRun});
        });
      } break;

      case `mode change`: {
        const currentStat = await baseFs.statPromise(eff.path);
        const currentMode = currentStat.mode;

        if (isExecutable(eff.newMode) !== isExecutable(currentMode))
          continue;

        await preserveTime(baseFs, eff.path, async () => {
          await baseFs.chmodPromise(eff.path, eff.newMode);
        });
      } break;

      default: {
        miscUtils.assertNever(eff);
      } break;
    }
  }
}

function isExecutable(fileMode: number) {
  return (fileMode & 0o100) > 0;
}

function trimRight(s: string) {
  return s.replace(/\s+$/, ``);
}

function linesAreEqual(a: string, b: string) {
  return trimRight(a) === trimRight(b);
}

/**
 * How does noNewLineAtEndOfFile work?
 *
 * if you remove the newline from a file that had one without editing other bits:
 *
 *    it creates an insertion/removal pair where the insertion has \ No new line at end of file
 *
 * if you edit a file that didn't have a new line and don't add one:
 *
 *    both insertion and deletion have \ No new line at end of file
 *
 * if you edit a file that didn't have a new line and add one:
 *
 *    deletion has \ No new line at end of file
 *    but not insertion
 *
 * if you edit a file that had a new line and leave it in:
 *
 *    neither insetion nor deletion have the annoation
 *
 */

export async function applyPatch({hunks, path}: FilePatch, {baseFs, dryRun = false}: {baseFs: FakeFS<PortablePath>, dryRun?: boolean}) {
  const mode = await baseFs.statSync(path).mode;

  const fileContents = await baseFs.readFileSync(path, `utf8`);
  const fileLines = fileContents.split(/\n/);

  const result: Array<Array<Modification>> = [];

  for (const hunk of hunks) {
    let fuzzingOffset = 0;
    while (true) {
      const modifications = evaluateHunk(hunk, fileLines, fuzzingOffset);
      if (modifications) {
        result.push(modifications);
        break;
      }

      if (fuzzingOffset < 0)
        fuzzingOffset = fuzzingOffset * -1;
      else
        fuzzingOffset = fuzzingOffset * -1 - 1;

      if (Math.abs(fuzzingOffset) > 60) {
        throw new Error(`Can't apply hunk ${hunks.indexOf(hunk)} for file ${path}`);
      }
    }
  }

  if (dryRun)
    return;

  let diffOffset = 0;

  for (const modifications of result) {
    for (const modification of modifications) {
      switch (modification.type) {
        case `splice`: {
          const firstLine = modification.index + diffOffset;
          fileLines.splice(firstLine, modification.numToDelete, ...modification.linesToInsert);
          diffOffset += modification.linesToInsert.length - modification.numToDelete;
        } break;

        case `pop`: {
          fileLines.pop();
        } break;

        case `push`: {
          fileLines.push(modification.line);
        } break;

        default: {
          miscUtils.assertNever(modification);
        } break;
      }
    }
  }

  await baseFs.writeFilePromise(path, fileLines.join(`\n`), {mode});
}

type Push = {
  type: `push`,
  line: string,
};

type Pop = {
  type: `pop`,
};

type Splice = {
  type: `splice`,
  index: number,
  numToDelete: number,
  linesToInsert: string[],
};

type Modification =
  | Push
  | Pop
  | Splice;

function evaluateHunk(hunk: Hunk, fileLines: Array<string>, fuzzingOffset: number): Modification[] | null {
  const result: Array<Modification> = [];

  let contextIndex = hunk.header.original.start - 1 + fuzzingOffset;
  if (contextIndex < 0)
    return null;
  if (fileLines.length - contextIndex < hunk.header.original.length)
    return null;

  for (const part of hunk.parts) {
    switch (part.type) {
      case `deletion`:
      case `context`: {
        for (const line of part.lines) {
          const originalLine = fileLines[contextIndex];

          if (!linesAreEqual(originalLine, line))
            return null;

          contextIndex += 1;
        }

        if (part.type === `deletion`) {
          result.push({
            type: `splice`,
            index: contextIndex - part.lines.length,
            numToDelete: part.lines.length,
            linesToInsert: [],
          });

          if (part.noNewlineAtEndOfFile) {
            result.push({
              type: `push`,
              line: ``,
            });
          }
        }
      } break;

      case `insertion`: {
        result.push({
          type: `splice`,
          index: contextIndex,
          numToDelete: 0,
          linesToInsert: part.lines,
        });

        if (part.noNewlineAtEndOfFile) {
          result.push({type: "pop"});
        }
      } break;

      default: {
        miscUtils.assertNever(part.type);
      } break;
    }
  }

  return result;
}
