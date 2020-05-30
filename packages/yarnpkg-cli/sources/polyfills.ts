// Remove when dropping Node 10 (~April 2021)
import 'array-flat-polyfill';

// @ts-ignore: missing declaration
import fromEntries from 'fromentries';


// Remove when dropping Node 10 (~April 2021)
if (!Object.fromEntries)
  Object.fromEntries = fromEntries;
