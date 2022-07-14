import fs               from 'fs';
import {fileURLToPath}  from 'url';

import * as loaderUtils from '../loaderUtils';

// The default `load` doesn't support reading from zip files
export async function load(
  urlString: string,
  context: { format: string | null | undefined },
  nextLoad: typeof load,
): Promise<{ format: string, source: string, shortCircuit: boolean }> {
  const url = loaderUtils.tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return nextLoad(urlString, context, nextLoad);

  const filePath = fileURLToPath(url);

  const format = loaderUtils.getFileFormat(filePath);
  if (!format)
    return nextLoad(urlString, context, nextLoad);

  return {
    format,
    source: await fs.promises.readFile(filePath, `utf8`),
    shortCircuit: true,
  };
}
