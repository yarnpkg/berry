import {npath}         from '@yarnpkg/fslib';
import * as vscode     from 'vscode';

import {ZipFSProvider} from './ZipFSProvider';

function mount(uri: vscode.Uri) {
  const zipUri = vscode.Uri.parse(`zip:${uri.fsPath}`);

  if (vscode.workspace.getWorkspaceFolder(zipUri) === undefined) {
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, 0, {
      name: npath.basename(zipUri.fsPath),
      uri: zipUri,
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.registerFileSystemProvider(`zip`, new ZipFSProvider(), {
    isCaseSensitive: true,
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`zipfs.mountZipFile`, (uri: vscode.Uri) => {
    mount(uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`zipfs.mountZipEditor`, () => {
    mount(vscode.window.activeTextEditor!.document.uri);
  }));
}
