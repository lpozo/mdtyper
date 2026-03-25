import {
  Editor,
  rootCtx,
  defaultValueCtx,
  remarkPluginsCtx,
  editorStateOptionsCtx,
} from '@milkdown/kit/core';
import type { RemarkPlugin } from '@milkdown/transformer';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { nord } from '@milkdown/theme-nord';
import { replaceAll } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
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

        // Milkdown's commonmark preset has no link input rule. We add one via
        // editorStateOptionsCtx, which is called synchronously at state-creation
        // time with the fully-built schema — no timer races possible.
        ctx.update(editorStateOptionsCtx, (prev) => (opts) => {
          const result = prev(opts);
          const schema = result.schema;
          if (!schema) return result;
          const linkMarkType = schema.marks['link'];
          if (!linkMarkType) return result;
          result.plugins = [
            ...(result.plugins ?? []),
            new Plugin({
              props: {
                handleTextInput(view: EditorView, from: number, to: number, text: string): boolean {
                  const st = view.state;
                  const $from = st.doc.resolve(from);
                  if ($from.parent.type.spec.code) return false;
                  const textBefore =
                    $from.parent.textBetween(
                      Math.max(0, $from.parentOffset - 200),
                      $from.parentOffset,
                      undefined,
                      '\uFFFC',
                    ) + text;
                  const match = /\[([^\[\]]+)\]\(([^()]+)\)$/.exec(textBefore);
                  if (!match?.[0] || !match[1] || !match[2]) return false;
                  const [fullMatch, linkText, href] = match;
                  const start = from - (fullMatch.length - text.length);
                  const tr = st.tr.replaceWith(
                    start,
                    to,
                    st.schema.text(linkText, [
                      linkMarkType.create({
                        href: href.trim(),
                        title: null,
                      }),
                    ]),
                  );
                  view.dispatch(tr);
                  return true;
                },
                handleDOMEvents: {
                  blur(view: EditorView): boolean {
                    const { state } = view;
                    const linkRe = /\[([^\[\]]+)\]\(([^()]+)\)/g;
                    type Match = { from: number; to: number; text: string; href: string };
                    const matches: Match[] = [];
                    state.doc.descendants((node, pos) => {
                      if (!node.isText || !node.text) return;
                      if (node.marks.some((m) => m.type === linkMarkType)) return;
                      linkRe.lastIndex = 0;
                      let m: RegExpExecArray | null;
                      while ((m = linkRe.exec(node.text)) !== null) {
                        if (!m[1] || !m[2]) continue;
                        matches.push({
                          from: pos + m.index,
                          to: pos + m.index + m[0].length,
                          text: m[1],
                          href: m[2].trim(),
                        });
                      }
                    });
                    if (matches.length === 0) return false;
                    // Apply in reverse order so earlier positions stay valid
                    let tr = state.tr;
                    for (let i = matches.length - 1; i >= 0; i--) {
                      const curr = matches[i];
                      if (!curr) continue;
                      const { from, to, text, href } = curr;
                      tr = tr.replaceWith(
                        from,
                        to,
                        state.schema.text(text, [
                          linkMarkType.create({ href, title: null }),
                        ]),
                      );
                    }
                    view.dispatch(tr);
                    return false;
                  },
                },
              },
            }),
          ];
          return result;
        });

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
