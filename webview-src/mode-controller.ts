import { postEdit } from './vscode-bridge';
import { EditorService } from './editor-service';

type Mode = 'wysiwyg' | 'raw';

export class ModeController {
  private mode: Mode = 'wysiwyg';

  constructor(
    private readonly editorEl: HTMLElement,
    private readonly rawEl: HTMLTextAreaElement,
    private readonly toggleBtn: HTMLButtonElement,
    private readonly editorService: EditorService,
  ) {}

  get currentMode(): Mode {
    return this.mode;
  }

  toggle(): void {
    if (this.mode === 'wysiwyg') {
      this.rawEl.value = this.editorService.currentMarkdown;
      this.editorEl.style.display = 'none';
      this.rawEl.style.display = 'block';
      this.rawEl.focus();
      this.toggleBtn.textContent = 'WYSIWYG';
      this.mode = 'raw';
    } else {
      const rawContent = this.rawEl.value;
      this.editorEl.style.display = '';
      this.rawEl.style.display = 'none';
      this.toggleBtn.textContent = 'Source';
      this.mode = 'wysiwyg';
      if (
        this.editorService.isReady &&
        rawContent !== this.editorService.currentMarkdown
      ) {
        this.editorService.replaceContent(rawContent); // sets guard internally
        this.editorService.currentMarkdown = rawContent;
        postEdit(rawContent);
      }
    }
  }

  updateRaw(content: string): void {
    this.rawEl.value = content;
  }
}
