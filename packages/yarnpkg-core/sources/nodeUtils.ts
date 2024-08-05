import {PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import os                         from 'os';

import * as execUtils             from './execUtils';
import * as miscUtils             from './miscUtils';

export const major = Number(process.versions.node.split(`.`)[0]);

const openUrlBinary = new Map([
  [`darwin`, `open`],
  [`linux`, `xdg-open`],
  [`win32`, `explorer.exe`],
]).get(process.platform);

export const openUrl = typeof openUrlBinary !== `undefined`
  ? async (url: string) => {
    try {
      await execUtils.execvp(openUrlBinary, [url], {cwd: ppath.cwd()});
      return true;
    } catch {
      return false;
    }
  }
  : undefined;

const LDD_PATH = `/usr/bin/ldd` as PortablePath;

function getLibc() {
  // Darwin and Windows have their own standard libraries, and the getReport() call is costly.
  // It also seems that Node randomly crashes with no output under some circumstances when running a getReport() on Windows.
  if (process.platform === `darwin` || process.platform === `win32`)
    return null;

  let header: Buffer | undefined;
  try {
    header = xfs.readFileSync(LDD_PATH);
  } catch {}

  // Since the getReport can be prohibitely expensive (it also queries DNS which, if misconfigured, can take a long time to timeout),
  // we first check if the ldd binary is glibc or musl, and only then run the getReport() if we can't determine the libc variant.
  if (typeof header !== `undefined`) {
    if (header && (header.includes(`GLIBC`) || header.includes(`libc`)))
      return `glibc`;
    if (header && header.includes(`musl`)) {
      return `musl`;
    }
  }

  const report: any = process.report?.getReport() ?? {};
  const sharedObjects: Array<string> = report.sharedObjects ?? [];

  // Matches the first group if libc, second group if musl
  const libcRegExp = /\/(?:(ld-linux-|[^/]+-linux-gnu\/)|(libc.musl-|ld-musl-))/;

  return miscUtils.mapAndFind(sharedObjects, entry => {
    const match = entry.match(libcRegExp);
    if (!match)
      return miscUtils.mapAndFind.skip;

    if (match[1])
      return `glibc`;
    if (match[2])
      return `musl`;

    throw new Error(`Assertion failed: Expected the libc variant to have been detected`);
  }) ?? null;
}

export type Architecture = {
  os: string;
  cpu: string;
  libc: string | null;
};

export type ArchitectureSet = {
  os: Array<string> | null;
  cpu: Array<string> | null;
  libc: Array<string> | null;
};

let architecture: Architecture | undefined;
let architectureSet: ArchitectureSet | undefined;

export function getArchitecture() {
  return architecture = architecture ?? {
    os: process.platform,
    cpu: process.arch,
    libc: getLibc(),
  };
}

export function getArchitectureName(architecture = getArchitecture()) {
  if (architecture.libc) {
    return `${architecture.os}-${architecture.cpu}-${architecture.libc}`;
  } else {
    return `${architecture.os}-${architecture.cpu}`;
  }
}

export function getArchitectureSet() {
  const architecture = getArchitecture();

  return architectureSet = architectureSet ?? {
    os: [architecture.os],
    cpu: [architecture.cpu],
    libc: architecture.libc ? [architecture.libc] : [],
  };
}

export type Caller = {
  file: string | null;
  methodName: string;
  arguments: Array<string>;
  line: number | null;
  column: number | null;
};

const chromeRe = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
const chromeEvalRe = /\((\S*)(?::(\d+))(?::(\d+))\)/;

// https://github.com/errwischt/stacktrace-parser/blob/f70768a12579de3469f3fdfdc423657ee6609c7c/src/stack-trace-parser.js
function parseStackLine(line: string): Caller | null {
  const parts = chromeRe.exec(line);
  if (!parts)
    return null;

  const isNative = parts[2] && parts[2].indexOf(`native`) === 0; // start of line
  const isEval = parts[2] && parts[2].indexOf(`eval`) === 0; // start of line

  const submatch = chromeEvalRe.exec(parts[2]);
  if (isEval && submatch != null) {
    // throw out eval line/column and use top-most line/column number
    parts[2] = submatch[1]; // url
    parts[3] = submatch[2]; // line
    parts[4] = submatch[3]; // column
  }

  return {
    file: !isNative ? parts[2] : null,
    methodName: parts[1] || `<unknown>`,
    arguments: isNative ? [parts[2]] : [],
    line: parts[3] ? +parts[3] : null,
    column: parts[4] ? +parts[4] : null,
  };
}

export function getCaller() {
  const err = new Error();
  const line = err.stack!.split(`\n`)[3];

  return parseStackLine(line);
}

export function availableParallelism() {
  // TODO: Use os.availableParallelism directly when dropping support for Node.js < 19.4.0
  if (typeof os.availableParallelism !== `undefined`)
    return os.availableParallelism();

  return Math.max(1, os.cpus().length);
}
