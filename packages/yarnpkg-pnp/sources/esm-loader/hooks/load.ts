import fs                                      from 'fs';
import {fileURLToPath}                         from 'url';

import {HAS_JSON_IMPORT_ASSERTION_REQUIREMENT} from '../loaderFlags';
import * as loaderUtils                        from '../loaderUtils';

// The default `load` doesn't support reading from zip files
export async function load(
  urlString: string,
  context: {
    format: string | null | undefined;
    importAssertions?: {
      type?: 'json';
    };
  },
  nextLoad: typeof load,
): Promise<{ format: string, source: string, shortCircuit: boolean }> {
  const url = loaderUtils.tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return nextLoad(urlString, context, nextLoad);

  const filePath = fileURLToPath(url);

  const format = loaderUtils.getFileFormat(filePath);
  if (!format)
    return nextLoad(urlString, context, nextLoad);

  if (HAS_JSON_IMPORT_ASSERTION_REQUIREMENT && format === `json` && context.importAssertions?.type !== `json`) {
    const err = new TypeError(`[ERR_IMPORT_ASSERTION_TYPE_MISSING]: Module "${urlString}" needs an import assertion of type "json"`) as TypeError & { code: string };
    err.code = `ERR_IMPORT_ASSERTION_TYPE_MISSING`;
    throw err;
  }

  return {
    format,
    source: await fs.promises.readFile(filePath, `utf8`),
    shortCircuit: true,
  };
}
