import {ppath}        from '@yarnpkg/fslib';
import Module         from 'module';
import os             from 'os';

import * as execUtils from './execUtils';
import * as miscUtils from './miscUtils';

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

export function builtinModules(): Set<string> {
  // @ts-expect-error
  return new Set(Module.builtinModules || Object.keys(process.binding(`natives`)));
}

function getLibc() {
  // It seems that Node randomly crashes with no output under some circumstances when running a getReport() on Windows.
  // Since Windows has no libc anyway, shortcut this path.
  if (process.platform === `win32`)
    return null;

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

export function availableParallelism() {
  // TODO: Use os.availableParallelism directly when dropping support for Node.js < 19.4.0
  if (`availableParallelism` in os)
    // @ts-expect-error - No types yet
    return os.availableParallelism();

  return Math.max(1, os.cpus().length);
}
