import * as vscode from 'vscode';
import { isExtensionMessage, type WebviewMessage } from './messages';
import { resolveLink } from './link-resolver';
import { getHtmlForWebview } from './webview-html';

export class MdTyperEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'mdtyper.markdownEditor';

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MdTyperEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      MdTyperEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          // Keep Milkdown alive when switching tabs — avoids costly re-initialization
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
      ],
    };

    webviewPanel.webview.html = getHtmlForWebview(
      webviewPanel.webview,
      this.context.extensionUri,
    );

    // Guard flag: prevents echo loop when we apply a WorkspaceEdit in response
    // to a webview 'edit' message — that edit fires onDidChangeTextDocument,
    // which without this flag would re-send the content back to the webview.
    let isUpdatingFromWebview = false;

    const onDidChangeDocument = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) {
          return;
        }
        if (isUpdatingFromWebview) {
          return;
        }
        webviewPanel.webview.postMessage({
          type: 'update',
          content: document.getText(),
        } satisfies WebviewMessage);
      },
    );

    const onDidReceiveMessage = webviewPanel.webview.onDidReceiveMessage(
      async (raw: unknown) => {
        if (!isExtensionMessage(raw)) {
          return;
        }
        switch (raw.type) {
          case 'ready':
            // Webview just initialized; send the current document content
            webviewPanel.webview.postMessage({
              type: 'update',
              content: document.getText(),
            } satisfies WebviewMessage);
            break;

          case 'link':
            await resolveLink(raw.href, document.uri);
            break;

          case 'edit': {
            isUpdatingFromWebview = true;
            try {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                raw.content,
              );
              const applied = await vscode.workspace.applyEdit(edit);
              if (!applied) {
                console.error(
                  'MdTyper: applyEdit returned false — edit was rejected',
                );
              }
            } catch (err) {
              console.error('MdTyper: applyEdit threw unexpectedly', err);
            } finally {
              isUpdatingFromWebview = false;
            }
            break;
          }
        }
      },
    );

    webviewPanel.onDidDispose(() => {
      onDidChangeDocument.dispose();
      onDidReceiveMessage.dispose();
    });
  }
}
