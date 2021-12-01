import {npath}                        from '@yarnpkg/fslib';
import * as vscode                    from 'vscode';

import {registerTerminalLinkProvider} from './TerminalLinkProvider';
import {ZipFSProvider}                from './ZipFSProvider';

function mount(uri: vscode.Uri) {
  const zipUri = vscode.Uri.parse(`zip:${uri.fsPath}`);

  if (vscode.workspace.getWorkspaceFolder(zipUri) === undefined) {
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, 0, {
      name: npath.basename(zipUri.fsPath),
      uri: zipUri,
    });
  }
}

function unmount(uri: vscode.Uri): void {
  const zipUri = vscode.Uri.parse(`zip:${uri.fsPath}`);

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(zipUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(`Cannot unmount ${zipUri.fsPath}: not mounted`);
    return;
  }

  if (!vscode.workspace.workspaceFolders)
    throw new Error(`Assertion failed: workspaceFolders is undefined`);

  // When calling `updateWorkspaceFolders`, vscode still keeps the "workspace mode" even if a single folder remains which is quite annoying.
  // Because of this, we execute `vscode.openFolder` to open the workspace folder.
  if (vscode.workspace.workspaceFolders.length === 2) {
    const otherFolder = vscode.workspace.workspaceFolders.find(folder => folder.index !== workspaceFolder.index)!;

    vscode.commands.executeCommand(`vscode.openFolder`, otherFolder.uri, {forceNewWindow: false});
  } else {
    vscode.workspace.updateWorkspaceFolders(workspaceFolder.index, 1);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Until a more specific activation event exists this requires onStartupFinished
  context.subscriptions.push(registerTerminalLinkProvider());

  context.subscriptions.push(vscode.workspace.registerFileSystemProvider(`zip`, new ZipFSProvider(), {
    isCaseSensitive: true,
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`zipfs.mountZipFile`, (uri: vscode.Uri) => {
    mount(uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`zipfs.unmountZipFile`, (uri: vscode.Uri) => {
    unmount(uri);
  }));

  context.subscriptions.push(vscode.commands.registerCommand(`zipfs.mountZipEditor`, () => {
    mount(vscode.window.activeTextEditor!.document.uri);
  }));
}
