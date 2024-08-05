import {VirtualFS, npath}                                                                            from '@yarnpkg/fslib';
import fs                                                                                            from 'fs';
import {fileURLToPath, pathToFileURL}                                                                from 'url';

import {SUPPORTS_IMPORT_ATTRIBUTES, SUPPORTS_IMPORT_ATTRIBUTES_ONLY, WATCH_MODE_MESSAGE_USES_ARRAYS} from '../loaderFlags';
import * as loaderUtils                                                                              from '../loaderUtils';

// The default `load` doesn't support reading from zip files
export async function load(
  urlString: string,
  context: {
    format: string | null | undefined;
    importAssertions?: {
      type?: 'json';
    };
    importAttributes?: {
      type?: 'json';
    };
  },
  nextLoad: typeof load,
): Promise<{ format: string, source?: string, shortCircuit: boolean }> {
  const url = loaderUtils.tryParseURL(urlString);
  if (url?.protocol !== `file:`)
    return nextLoad(urlString, context, nextLoad);

  const filePath = fileURLToPath(url);

  const format = loaderUtils.getFileFormat(filePath);
  if (!format)
    return nextLoad(urlString, context, nextLoad);

  if (format === `json`) {
    if (SUPPORTS_IMPORT_ATTRIBUTES_ONLY) {
      if (context.importAttributes?.type !== `json`) {
        const err = new TypeError(`[ERR_IMPORT_ATTRIBUTE_MISSING]: Module "${urlString}" needs an import attribute of "type: json"`) as TypeError & { code: string };
        err.code = `ERR_IMPORT_ATTRIBUTE_MISSING`;
        throw err;
      }
    } else {
      const type = `importAttributes` in context ? context.importAttributes?.type : context.importAssertions?.type;
      if (type !== `json`) {
        const err = new TypeError(`[ERR_IMPORT_ASSERTION_TYPE_MISSING]: Module "${urlString}" needs an import ${SUPPORTS_IMPORT_ATTRIBUTES ? `attribute` : `assertion`} of type "json"`) as TypeError & { code: string };
        err.code = `ERR_IMPORT_ASSERTION_TYPE_MISSING`;
        throw err;
      }
    }
  }

  // https://github.com/nodejs/node/pull/44366/files#diff-f6796082f599554ec3a29c47cf026cb24fc5104884f2632e472c05fe622d778bR477-R479
  if (process.env.WATCH_REPORT_DEPENDENCIES && process.send) {
    // At the time of writing Node.js reports all loaded URLs itself so
    // we technically only need to do this for virtual files but in the
    // event that ever changes we report everything.
    const pathToSend = pathToFileURL(
      npath.fromPortablePath(
        VirtualFS.resolveVirtual(npath.toPortablePath(filePath)),
      ),
    ).href;
    process.send({
      'watch:import': WATCH_MODE_MESSAGE_USES_ARRAYS ? [pathToSend] : pathToSend,
    });
  }

  return {
    format,
    source: format === `commonjs` ? undefined : await fs.promises.readFile(filePath, `utf8`),
    shortCircuit: true,
  };
}
