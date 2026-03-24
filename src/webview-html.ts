import * as vscode from 'vscode';

export function getNonce(): string {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getHtmlForWebview(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'theme.css'),
  );
  const nordThemeUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'nord-theme.css'),
  );

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
  <link rel="stylesheet" href="${nordThemeUri}" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>MdTyper</title>
</head>
<body>
  <button id="toggle-btn">Source</button>
  <div id="editor"></div>
  <textarea id="raw" spellcheck="false"></textarea>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
