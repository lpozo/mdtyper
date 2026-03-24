import * as vscode from 'vscode';

// Messages sent FROM extension host TO webview
type WebviewMessage = { type: 'update'; content: string };

// Messages sent FROM webview TO extension host
type ExtensionMessage = { type: 'ready' } | { type: 'edit'; content: string };

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

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Guard flag: prevents echo loop when we apply a WorkspaceEdit in response
    // to a webview 'edit' message — that edit fires onDidChangeTextDocument,
    // which without this flag would re-send the content back to the webview.
    let isUpdatingFromWebview = false;

    // Extension host → Webview: push updated document content on external change
    const onDidChangeDocument = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() !== document.uri.toString()) {
          return;
        }
        if (isUpdatingFromWebview) {
          // We caused this change; don't echo it back
          return;
        }
        webviewPanel.webview.postMessage({
          type: 'update',
          content: document.getText(),
        } satisfies WebviewMessage);
      },
    );

    // Webview → Extension host: apply user edits to the TextDocument
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

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'theme.css'),
    );

    // Nonce locks script execution to our bundle only
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 img-src ${cspSource} https: data:;
                 font-src ${cspSource};">
  <link rel="stylesheet" href="${styleUri}" />
  <title>MdTyper</title>
</head>
<body>
  <div id="editor"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const type = (value as Record<string, unknown>)['type'];
  if (type === 'ready') {
    return true;
  }
  if (type === 'edit') {
    return typeof (value as Record<string, unknown>)['content'] === 'string';
  }
  return false;
}

function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
