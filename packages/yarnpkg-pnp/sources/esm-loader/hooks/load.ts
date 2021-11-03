import fs               from 'fs';
import {fileURLToPath}  from 'url';

import * as loaderUtils from '../loaderUtils';

// The default `load` doesn't support reading from zip files
export async function load(
  urlString: string,
  context: { format: string | null | undefined },
  defaultLoad: typeof load,
): Promise<{ format: string, source: string }> {
  const url = loaderUtils.tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return defaultLoad(urlString, context, defaultLoad);

  const filePath = fileURLToPath(url);

  const format = loaderUtils.getFileFormat(filePath);
  if (!format)
    return defaultLoad(urlString, context, defaultLoad);

  return {
    format,
    source: await fs.promises.readFile(filePath, `utf8`),
  };
}
