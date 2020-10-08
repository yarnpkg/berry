import * as vscode from 'vscode';

interface YamlExtension {
  registerContributor(
    schema: string,
    requestSchema: (resource: string) => string | undefined,
  ): void;
}

async function activateYamlExtension(): Promise<YamlExtension | undefined> {
  const extension = vscode.extensions.getExtension(`redhat.vscode-yaml`);
  if (!extension)
    return undefined;

  const extensionAPI = await extension.activate();
  if (!extensionAPI || !extensionAPI.registerContributor)
    return undefined;

  return extensionAPI;
}

export async function registerYamlSchema() {
  const yamlPlugin = await activateYamlExtension();
  yamlPlugin?.registerContributor(
    `yarnrc`,
    resource => {
      if (resource.endsWith(`.yarnrc.yml`))
        return `https://raw.githubusercontent.com/yarnpkg/berry/master/packages/gatsby/src/pages/configuration/yarnrc.json`;

      return undefined;
    },
  );
}
