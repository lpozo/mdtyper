import { postReady, postEdit } from './vscode-bridge';
import { EditorService } from './editor-service';
import { ModeController } from './mode-controller';
import { initLinkInterceptor } from './link-interceptor';

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

const editorService = new EditorService();
const modeController = new ModeController(editorEl, rawEl, toggleBtn, editorService);

rawEl.addEventListener('input', () => {
  editorService.currentMarkdown = rawEl.value;
  postEdit(rawEl.value);
});

toggleBtn.addEventListener('click', () => {
  modeController.toggle();
});

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

window.addEventListener('message', (event: MessageEvent) => {
  void (async () => {
    try {
      console.log('MdTyper: received message', event.data);
      if (!isUpdateMessage(event.data)) {
        console.log('MdTyper: message is not an update message');
        return;
      }
      const content = event.data.content;
      console.log('MdTyper: received content, length:', content.length);
      editorService.currentMarkdown = content;

      if (modeController.currentMode === 'raw') {
        // In raw mode: update the textarea directly; Milkdown is not mounted yet
        // (first load) or is hidden — don't touch it.
        modeController.updateRaw(content);
        return;
      }

      if (!editorService.isReady) {
        // First message after 'ready': initialize Milkdown with document content.
        // Guard must be set here too: ProseMirror dispatches a transaction for the
        // initial document load, which would fire markdownUpdated and echo the
        // content back as an 'edit', marking the file dirty on first open.
        console.log('MdTyper: initializing editor with content');
        editorService.setHostUpdateGuard();
        await editorService.init(editorEl, content);
        console.log('MdTyper: editor initialized');
      } else {
        editorService.replaceContent(content);
      }
    } catch (err) {
      console.error('MdTyper: error handling message from extension host', err);
    }
  })();
});

initLinkInterceptor();

console.log('MdTyper: script loaded, posting ready message');
console.log('MdTyper: editor element found:', !!editorEl);

postReady();
console.log('MdTyper: ready message posted');
