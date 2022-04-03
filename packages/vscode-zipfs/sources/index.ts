import {npath, NativePath}            from '@yarnpkg/fslib';
import path                           from 'path';
import * as vscode                    from 'vscode';

import {registerTerminalLinkProvider} from './TerminalLinkProvider';
import {ZipFSProvider}                from './ZipFSProvider';


export function parseUri(uri: vscode.Uri): NativePath {
  const p = `${path.sep}${uri.authority}${path.sep}${uri.fsPath}` as NativePath;

  return p;
}

function mount(uri: vscode.Uri) {
  const zipUri = vscode.Uri.parse(`zip:${parseUri(uri)}`);

  if (vscode.workspace.getWorkspaceFolder(zipUri) === undefined) {
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders!.length, 0, {
      name: npath.basename(zipUri.fsPath),
      uri: zipUri,
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(registerTerminalLinkProvider());

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
