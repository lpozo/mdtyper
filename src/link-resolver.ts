import * as vscode from 'vscode';

export async function resolveLink(
  href: string,
  documentUri: vscode.Uri,
): Promise<void> {
  if (/^https?:\/\//i.test(href)) {
    await vscode.env.openExternal(vscode.Uri.parse(href));
  } else if (!href.startsWith('#')) {
    // Resolve relative to the directory containing the open document
    const docDir = vscode.Uri.joinPath(documentUri, '..');
    const targetUri = vscode.Uri.joinPath(docDir, href);
    try {
      await vscode.window.showTextDocument(targetUri);
    } catch (err) {
      console.error('MdTyper: could not open link target', err);
    }
  }
}
