import util                  from 'util';

import {FakeFS}              from './FakeFS';
import {NoopFS}              from './NoopFS';
import {PortablePath, ppath} from './path';

const styleText: (color: string, text: string) => string = (util as any).styleText ?? ((color, text) => text);

const shortenValue = (value: string, length: number): string => {
  return value.length > length
    ? `${value.slice(0, length)}...`
    : value;
};

const shortenArray = (values: Array<any>, length: number): string => {
  return values.length > length
    ? `[${values.slice(0, length).map(value => traceValue(value)).join(`, `)}, ...]`
    : `[${values.map(value => traceValue(value)).join(`, `)}]`;
};

export const traceValue = (value: any) => {
  if (value === null)
    return styleText(`cyan`, `null`);

  if (typeof value === `string` && value.match(/^\/[a-z]+/i))
    return styleText(`magentaBright`, ppath.relative(ppath.cwd(), value as PortablePath));

  if (typeof value === `string`)
    return styleText(`green`, JSON.stringify(shortenValue(value, 80)));

  if (typeof value === `number`)
    return styleText(`yellow`, value.toString());

  if (typeof value === `boolean`)
    return styleText(`magentaBright`, value.toString());

  if (value instanceof Error && `code` in value)
    return `${styleText(`red`, (value as any).code)}: ${styleText(`red`, JSON.stringify(shortenValue(value.message, 60)))}`;

  if (Array.isArray(value))
    return shortenArray(value, 3);

  if (typeof value === `object` && Buffer.isBuffer(value))
    return styleText(`blue`, `Buffer<${value.length}>`);

  if (typeof value === `object`)
    return shortenValue(util.inspect(JSON.parse(JSON.stringify(value)), {compact: true}), 80);

  return `{}`;
};

const filter = process.env.TRACEFS_FILTER
  ? new RegExp(process.env.TRACEFS_FILTER)
  : null;

const log = process.env.TRACEFS_STACKS === `1`
  ? console.trace
  : console.log;

export const defaultTraceFn: TraceFn = (fnName, args, result) => {
  if (filter && !JSON.stringify([args, result]).match(filter))
    return;

  log(`${styleText(`magenta`, `fs:`)} ${styleText(`gray`, `${fnName}(`)}${args.map(arg => traceValue(arg)).join(styleText(`grey`, `, `))}${styleText(`grey`, `) -> `)}${traceValue(result)}`);
};

export type TraceFn = (fnName: string, args: Array<any>, result: any) => void;

export class TraceFS extends NoopFS {
  traceFn: TraceFn;

  constructor({baseFs, traceFn = defaultTraceFn}: {baseFs: FakeFS<PortablePath>, traceFn?: TraceFn}) {
    super({baseFs});

    this.traceFn = traceFn;
  }
}

for (const fnName of Object.getOwnPropertyNames(NoopFS.prototype)) {
  if (fnName.endsWith(`Promise`)) {
    (TraceFS.prototype as any)[fnName] = async function (...args: Array<any>) {
      try {
        const result = await (this.baseFs as any)[fnName](...args);
        this.traceFn(fnName, args, result);
        return result;
      } catch (error) {
        this.traceFn(fnName, args, error);
        throw error;
      }
    };
  }

  if (fnName.endsWith(`Sync`)) {
    (TraceFS.prototype as any)[fnName] = function (...args: Array<any>) {
      try {
        const result = (this.baseFs as any)[fnName](...args);
        this.traceFn(fnName, args, result);
        return result;
      } catch (error) {
        this.traceFn(fnName, args, error);
        throw error;
      }
    };
  }
}
