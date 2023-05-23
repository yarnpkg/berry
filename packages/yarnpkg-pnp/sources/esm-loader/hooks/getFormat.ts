import {fileURLToPath}  from 'url';

import * as loaderUtils from '../loaderUtils';

// The default `getFormat` doesn't support reading from zip files
export async function getFormat(
  resolved: string,
  context: object,
  defaultGetFormat: typeof getFormat,
): Promise<{ format: string }> {
  const url = loaderUtils.tryParseURL(resolved);
  if (url?.protocol !== `file:`)
    return defaultGetFormat(resolved, context, defaultGetFormat);

  const format = loaderUtils.getFileFormat(fileURLToPath(url));
  if (format) {
    return {
      format,
    };
  }

  return defaultGetFormat(resolved, context, defaultGetFormat);
}
