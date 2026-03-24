// acquireVsCodeApi() is injected by the VS Code webview runtime.
// It MUST be called exactly once per webview lifetime.
// Type provided by @types/vscode-webview.
export const vscode = acquireVsCodeApi();

export function postReady(): void {
  vscode.postMessage({ type: 'ready' });
}

export function postEdit(content: string): void {
  vscode.postMessage({ type: 'edit', content });
}

export function postLink(href: string): void {
  vscode.postMessage({ type: 'link', href });
}
