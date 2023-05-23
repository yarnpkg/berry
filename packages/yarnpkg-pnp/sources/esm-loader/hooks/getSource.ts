import fs               from 'fs';
import {fileURLToPath}  from 'url';

import * as loaderUtils from '../loaderUtils';

// The default `getSource` doesn't support reading from zip files
export async function getSource(
  urlString: string,
  context: { format: string },
  defaultGetSource: typeof getSource,
): Promise<{ source: string }> {
  const url = loaderUtils.tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return defaultGetSource(urlString, context, defaultGetSource);

  return {
    source: await fs.promises.readFile(fileURLToPath(url), `utf8`),
  };
}
