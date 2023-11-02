import pnpApi                                                                                  from 'pnpapi';
import {Application, Converter, DeclarationReflection, ProjectReflection, SignatureReflection} from 'typedoc';

function resolveVirtual(path: string) {
  return pnpApi.resolveVirtual(path)?.replaceAll(`\\`, `/`) ?? path;
}

function remapPaths(context, ref: DeclarationReflection | ProjectReflection | SignatureReflection) {
  if (`sources` in ref) {
    for (const source of ref.sources ?? []) {
      source.fileName = resolveVirtual(source.fileName);
      source.fullFileName = resolveVirtual(source.fullFileName);
    }
  }
}

export function load(app: Application) {
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, remapPaths);
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, remapPaths);
}
