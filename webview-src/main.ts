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
declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

const vscode = acquireVsCodeApi();

let editor: Editor | null = null;

// Guard: when the extension host sends an 'update' message we apply replaceAll,
// which triggers markdownUpdated. Without this flag we'd echo the content back
// as an 'edit' message, causing an infinite update loop.
let isUpdatingFromHost = false;

async function initEditor(initialContent: string): Promise<void> {
  editor = await Editor.make()
    .config(ctx => {
      ctx.set(rootCtx, document.getElementById('editor')!);
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

// Receive messages from the extension host
window.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as { type: string; content?: string };

  if (msg.type === 'update' && typeof msg.content === 'string') {
    if (editor === null) {
      // First message after 'ready': initialize Milkdown with document content
      await initEditor(msg.content);
    } else {
      // Subsequent update (e.g. external file change): replace editor content
      isUpdatingFromHost = true;
      editor.action(replaceAll(msg.content));
      isUpdatingFromHost = false;
    }
  }
});

// Tell the extension host the webview is ready to receive content
vscode.postMessage({ type: 'ready' });
