import {
  Editor,
  rootCtx,
  defaultValueCtx,
  remarkPluginsCtx,
} from '@milkdown/kit/core';
import type { RemarkPlugin } from '@milkdown/transformer';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { nord } from '@milkdown/theme-nord';
import { replaceAll } from '@milkdown/kit/utils';
import remarkGfm from 'remark-gfm';
import { postEdit } from './vscode-bridge';

export class EditorService {
  private editor: Editor | null = null;
  private _currentMarkdown = '';

  // Guard: when the extension host sends an 'update' message we apply replaceAll,
  // which triggers markdownUpdated. Without this flag we'd echo the content back
  // as an 'edit' message, causing an infinite update loop.
  //
  // markdownUpdated is debounced by 200ms inside Milkdown, so the flag must stay
  // true long enough to cover that window. We use a timer instead of a finally
  // block to avoid resetting the flag before the debounced callback fires.
  private isUpdatingFromHost = false;
  private hostUpdateTimer: ReturnType<typeof setTimeout> | undefined;

  get isReady(): boolean {
    return this.editor !== null;
  }

  get currentMarkdown(): string {
    return this._currentMarkdown;
  }

  set currentMarkdown(value: string) {
    this._currentMarkdown = value;
  }

  setHostUpdateGuard(): void {
    this.isUpdatingFromHost = true;
    if (this.hostUpdateTimer !== undefined) clearTimeout(this.hostUpdateTimer);
    this.hostUpdateTimer = setTimeout(() => {
      this.isUpdatingFromHost = false;
      this.hostUpdateTimer = undefined;
    }, 300); // > 200ms Milkdown debounce
  }

  async init(editorEl: HTMLElement, initialContent: string): Promise<void> {
    console.log(
      'MdTyper: creating editor with content length:',
      initialContent.length,
    );
    this.editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorEl);
        ctx.set(defaultValueCtx, initialContent);
        // remarkGfm's TS signature doesn't structurally match RemarkPlugin<...>,
        // but it is a valid remark plugin at runtime — cast via unknown.
        const gfmPlugin = remarkGfm as unknown as RemarkPlugin<
          Record<string, unknown>
        >;
        ctx.update(remarkPluginsCtx, (prev) => [...prev, gfmPlugin]);

        ctx
          .get(listenerCtx)
          .markdownUpdated((_ctx, markdown, _prevMarkdown) => {
            console.log(
              'MdTyper: markdownUpdated, raw:',
              JSON.stringify(markdown),
            );
            this._currentMarkdown = markdown;
            if (this.isUpdatingFromHost) {
              return;
            }
            postEdit(markdown);
          });
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .create();
    console.log('MdTyper: editor created successfully');
  }

  replaceContent(content: string): void {
    if (this.editor === null) {
      return;
    }
    this.setHostUpdateGuard();
    this.editor.action(replaceAll(content));
  }
}
