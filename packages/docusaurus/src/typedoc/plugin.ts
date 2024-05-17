import {miscUtils}                                                                                           from '@yarnpkg/core';
// @ts-expect-error
import pnpApi                                                                                                from 'pnpapi';
import {Application, Converter, DeclarationReflection, ProjectReflection, SignatureReflection, type Context} from 'typedoc';

function resolveVirtual(path: string) {
  return pnpApi.resolveVirtual(path)?.replaceAll(`\\`, `/`) ?? path;
}

function remapPaths(context: Context, ref: DeclarationReflection | ProjectReflection | SignatureReflection) {
  if (`sources` in ref && ref.sources !== undefined) {
    const seen = new Set<string>();
    ref.sources = miscUtils.mapAndFilter(ref.sources, source => {
      source.fileName = resolveVirtual(source.fileName);
      source.fullFileName = resolveVirtual(source.fullFileName);

      const key = `${source.fullFileName}:${source.line}:${source.character}`;
      if (seen.has(key)) {
        return miscUtils.mapAndFilter.skip;
      } else {
        seen.add(key);
        return source;
      }
    });
  }
}

export function load(app: Application) {
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, remapPaths);
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, remapPaths);
}
