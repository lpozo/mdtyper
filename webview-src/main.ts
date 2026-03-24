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
//
// markdownUpdated is debounced by 200ms inside Milkdown, so the flag must stay
// true long enough to cover that window. We use a timer instead of a finally
// block to avoid resetting the flag before the debounced callback fires.
let isUpdatingFromHost = false;
let hostUpdateTimer: ReturnType<typeof setTimeout> | undefined;

function setHostUpdateGuard(): void {
  isUpdatingFromHost = true;
  if (hostUpdateTimer !== undefined) clearTimeout(hostUpdateTimer);
  hostUpdateTimer = setTimeout(() => {
    isUpdatingFromHost = false;
    hostUpdateTimer = undefined;
  }, 300); // > 200ms Milkdown debounce
}

// Last known markdown content — kept in sync by both views so toggling is lossless.
let currentMarkdown = '';

type Mode = 'wysiwyg' | 'raw';
let mode: Mode = 'wysiwyg';

const editorEl = document.getElementById('editor');
const rawEl = document.getElementById('raw') as HTMLTextAreaElement | null;
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement | null;

if (!editorEl) {
  throw new Error('MdTyper: #editor element not found in webview HTML');
}
if (!rawEl) {
  throw new Error('MdTyper: #raw element not found in webview HTML');
}
if (!toggleBtn) {
  throw new Error('MdTyper: #toggle-btn element not found in webview HTML');
}

// Forward raw textarea edits to the extension host in real time
rawEl.addEventListener('input', () => {
  currentMarkdown = rawEl.value;
  vscode.postMessage({ type: 'edit', content: rawEl.value });
});

toggleBtn.addEventListener('click', () => {
  if (mode === 'wysiwyg') {
    rawEl.value = currentMarkdown;
    editorEl.style.display = 'none';
    rawEl.style.display = 'block';
    rawEl.focus();
    toggleBtn.textContent = 'WYSIWYG';
    mode = 'raw';
  } else {
    const rawContent = rawEl.value;
    editorEl.style.display = '';
    rawEl.style.display = 'none';
    toggleBtn.textContent = 'Source';
    mode = 'wysiwyg';
    if (editor !== null && rawContent !== currentMarkdown) {
      setHostUpdateGuard();
      editor.action(replaceAll(rawContent));
      currentMarkdown = rawContent;
      vscode.postMessage({ type: 'edit', content: rawContent });
    }
  }
});

async function initEditor(initialContent: string): Promise<void> {
  editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, editorEl);
      ctx.set(defaultValueCtx, initialContent);

      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
        currentMarkdown = markdown;
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
      currentMarkdown = content;

      if (mode === 'raw') {
        // In raw mode: update the textarea directly; Milkdown is not mounted yet
        // (first load) or is hidden — don't touch it.
        rawEl.value = content;
        return;
      }

      if (editor === null) {
        // First message after 'ready': initialize Milkdown with document content.
        // Guard must be set here too: ProseMirror dispatches a transaction for the
        // initial document load, which would fire markdownUpdated and echo the
        // content back as an 'edit', marking the file dirty on first open.
        setHostUpdateGuard();
        await initEditor(content);
      } else {
        // Subsequent update (e.g. external file change): replace editor content
        setHostUpdateGuard();
        editor.action(replaceAll(content));
      }
    } catch (err) {
      console.error('MdTyper: error handling message from extension host', err);
    }
  })();
});

// Intercept link clicks and forward them to the extension host.
// Milkdown renders links as <a> elements; default navigation is blocked in
// webviews, so we must handle it ourselves.
document.addEventListener('click', (e: MouseEvent) => {
  const anchor = (e.target as HTMLElement).closest('a');
  if (!anchor) {
    return;
  }
  const href = anchor.getAttribute('href');
  if (!href) {
    return;
  }
  e.preventDefault();
  vscode.postMessage({ type: 'link', href });
});

// Tell the extension host the webview is ready to receive content
vscode.postMessage({ type: 'ready' });
