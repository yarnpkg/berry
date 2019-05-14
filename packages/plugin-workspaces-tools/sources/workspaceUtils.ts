import { Configuration, StreamReport, Workspace } from '@berry/core';
import { structUtils } from '@berry/core';
import { PassThrough } from 'stream';
import chalk from 'chalk';

export const createStream = ({prefix, report, interlaced}: {prefix: string | null, report: StreamReport, interlaced: boolean}) => {
  if (interlaced) {
    const stream = report.createStreamReporter(prefix);

    // We remove all `end` listeners because createStreamReporter adds a line break
    stream.removeAllListeners('end');

    const promise = new Promise(resolve => {
      stream.on('end', resolve);
    });

    return {
      stream,
      promise,
    };
  }

  return createBufferStream(prefix, report);
}

export const createBufferStream = (prefix: string | null, report: StreamReport) => {
  const stream = new PassThrough();
  const buffer: string[] = [];
  const streamReporter = report.createStreamReporter(prefix);

  const promise = new Promise(resolve => {
    stream.on('data', chunk => {
      buffer.push(chunk);
    });

    stream.on('end', () => {
      buffer.forEach(chunk => {
        streamReporter.write(chunk);
      });

      resolve();
    });
  });

  return {
    stream,
    promise
  };
};

type GetPrefixOptions = {
  configuration: Configuration;
  workspace: Workspace;
  commandCount: number;
  prefixed: boolean;
};

export const getPrefix = ({configuration, workspace, commandCount, prefixed}: GetPrefixOptions) => {
  const colors = [`cyan`, `green`, `yellow`, `blue`, `magenta`];
  const colorsEnabled = configuration.get(`enableColors`);
  const ident = structUtils.convertToIdent(workspace.locator);
  const name = structUtils.stringifyIdent(ident);
  const colorName = colors[commandCount % colors.length];

  let prefix = prefixed ? `[${name}]:` : null;

  if (prefix && colorsEnabled) {
    prefix = (chalk as any)[colorName](prefix);
  }

  return prefix;
};
