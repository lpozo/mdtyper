import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { nord } from '@milkdown/theme-nord';
import { replaceAll } from '@milkdown/kit/utils';

// acquireVsCodeApi() is injected by the VS Code webview runtime.
// It MUST be called exactly once per webview lifetime.
// Type provided by @types/vscode-webview.
const vscode = acquireVsCodeApi();

let editor: Editor | null = null;

// Guard: when the extension host sends an 'update' message we apply replaceAll,
// which triggers markdownUpdated. Without this flag we'd echo the content back
// as an 'edit' message, causing an infinite update loop.
let isUpdatingFromHost = false;

async function initEditor(initialContent: string): Promise<void> {
  const editorEl = document.getElementById('editor');
  if (!editorEl) {
    throw new Error('MdTyper: #editor element not found in webview HTML');
  }

  editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, editorEl);
      ctx.set(defaultValueCtx, initialContent);

      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
        if (isUpdatingFromHost) {
          return;
        }
        vscode.postMessage({ type: 'edit', content: markdown });
      });
    })
    .config(nord)
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(listener)
    .create();
}

function isUpdateMessage(
  value: unknown,
): value is { type: 'update'; content: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['type'] === 'update' &&
    typeof (value as Record<string, unknown>)['content'] === 'string'
  );
}

// Receive messages from the extension host
window.addEventListener('message', (event: MessageEvent) => {
  void (async () => {
    try {
      if (!isUpdateMessage(event.data)) {
        return;
      }
      const content = event.data.content;
      if (editor === null) {
        // First message after 'ready': initialize Milkdown with document content.
        // Guard must be set here too: ProseMirror dispatches a transaction for the
        // initial document load, which would fire markdownUpdated and echo the
        // content back as an 'edit', marking the file dirty on first open.
        isUpdatingFromHost = true;
        try {
          await initEditor(content);
        } finally {
          isUpdatingFromHost = false;
        }
      } else {
        // Subsequent update (e.g. external file change): replace editor content
        isUpdatingFromHost = true;
        try {
          editor.action(replaceAll(content));
        } finally {
          isUpdatingFromHost = false;
        }
      }
    } catch (err) {
      console.error('MdTyper: error handling message from extension host', err);
    }
  })();
});

// Tell the extension host the webview is ready to receive content
vscode.postMessage({ type: 'ready' });
