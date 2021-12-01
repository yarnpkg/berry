import {Cli, Command, Option, UsageError} from 'clipanion';
import fs                                 from 'fs';
import path                               from 'path';
import ts                                 from 'typescript';

async function parseFile(p: string) {
  const content = await fs.promises.readFile(p, `utf8`);

  return ts.createSourceFile(
    p,
    content,
    ts.ScriptTarget.ES2015,
    /* setParentNodes */ true,
  );
}

type HookDefinition = {
  name: string;
  definition: string;
  file?: string;
  comment?: string;
};

async function processFile(file: ts.SourceFile) {
  const hooks: Array<HookDefinition> = [];
  let isInsideInterface = false;

  const processNode = (node: ts.Node) => {
    switch (node.kind) {
      case ts.SyntaxKind.InterfaceDeclaration: {
        const interfaceNode = node as ts.InterfaceDeclaration;
        if (interfaceNode.name.getText() === `Hooks`) {
          isInsideInterface = true;
          ts.forEachChild(node, processNode);
          isInsideInterface = false;
        }
      } break;

      case ts.SyntaxKind.PropertySignature: {
        const propertySignatureNode = node as ts.PropertySignature;
        if (isInsideInterface) {
          const type = propertySignatureNode.type;
          if (type?.kind === ts.SyntaxKind.FunctionType) {
            const {character} = file.getLineAndCharacterOfPosition(propertySignatureNode.getStart());
            const removeIndent = (code: string) => code.replace(new RegExp(`^ {${character}}`, `gm`), ``);

            // undocumented
            const jsDoc = (propertySignatureNode as any).jsDoc;
            const comment = jsDoc && jsDoc.length > 0 ? jsDoc[jsDoc.length - 1].comment : undefined;

            hooks.push({
              name: propertySignatureNode.name.getText(),
              definition: removeIndent(propertySignatureNode.getText()),
              comment,
              file: file.fileName,
            });
          }
        }
      } break;

      default: {
        ts.forEachChild(node, processNode);
      } break;
    }
  };

  processNode(file);
  return hooks;
}

async function execute(files: Array<string>) {
  const allHooks = new Map<string, HookDefinition>();

  for (const relativePath of files) {
    const absolutePath = path.resolve(relativePath);
    const file = await parseFile(absolutePath);
    const fileHooks = await processFile(file);

    for (const hook of fileHooks) {
      let existingDefinition = allHooks.get(hook.name);
      if (typeof existingDefinition === `undefined`)
        allHooks.set(hook.name, existingDefinition = {...hook, file: undefined});

      if (existingDefinition.definition !== hook.definition)
        throw new UsageError(`Mismatched hook definitions for ${hook.name}`);

      if (typeof hook.comment !== `undefined`) {
        if (typeof existingDefinition.file !== `undefined`)
          if (existingDefinition.file !== hook.file)
            throw new UsageError(`Duplicate hook documentation; only document it in one file`);

        existingDefinition.comment = hook.comment;
        existingDefinition.file = hook.file;
      }
    }
  }

  const allHooksArray = [...allHooks.values()];

  allHooksArray.sort((a, b) => {
    return a.name < b.name ? -1 : a.name > b.name ? +1 : 0;
  });

  for (const hook of allHooksArray)
    if (typeof hook.comment === `undefined`)
      throw new UsageError(`Undocumented hook ${hook.name}`);

  return allHooksArray;
}

exports.execute = execute;

if (require.main === module) {
  Cli.from([
    class extends Command {
      files = Option.Rest();

      async execute() {
        const allHooks = await execute(this.files);
        this.context.stdout.write(`${JSON.stringify(allHooks, null, 2)}\n`);
      }
    },
  ]).runExit(
    process.argv.slice(2),
    Cli.defaultContext,
  );
}
