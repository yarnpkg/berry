// @ts-ignore: missing declaration
import fromEntries    from 'object.fromentries';
import promiseFinally from 'promise.prototype.finally';

// Remove when dropping Node 8
if (Symbol.asyncIterator == null)
  (Symbol as any).asyncIterator = Symbol.for(`Symbol.asyncIterator`);

// Remove when dropping Node 8
promiseFinally.shim();

// Remove when dropping Node 10 (~April 2021)
if (!Object.fromEntries)
  fromEntries.shim();
