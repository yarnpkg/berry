// @ts-expect-error: missing declaration
import fromEntries from 'fromentries';

// Remove when dropping Node 10 (~April 2021)
if (!Object.fromEntries)
  Object.fromEntries = fromEntries;
