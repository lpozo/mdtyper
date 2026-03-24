# MdTyper

A Typora-inspired WYSIWYG Markdown editor for Visual Studio Code. Write Markdown without seeing Markdown — headings, bold, lists, tables, and code blocks render inline as you type.

## Features

- **Inline WYSIWYG editing** — Markdown syntax is hidden and rendered in place, no split pane
- **Full CommonMark + GFM support** — headings, bold, italic, strikethrough, lists, task lists, tables, links, images, code blocks, blockquotes
- **Seamless VS Code integration** — save with Ctrl+S, dirty tracking, undo/redo, file watching
- **VS Code theme aware** — editor colors follow your active VS Code theme
- **Escape hatch** — reopen any file as raw Markdown text at any time

## Requirements

- Visual Studio Code 1.109 or later

## Installation

### From the Marketplace

Search for **MdTyper** in the VS Code Extensions panel and click Install.

### From a `.vsix` file

```bash
code --install-extension mdtyper-0.0.1.vsix
```

## Usage

Open any `.md` file — MdTyper activates automatically as the default editor.

### Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Bold | Ctrl+B |
| Italic | Ctrl+I |
| Save | Ctrl+S |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |

### Switch to raw text editor

Right-click the tab → **Reopen Editor With...** → **Text Editor**

Or run the command: **MdTyper: Reopen as Text Editor**

## Known Issues

None yet. Please report issues via the repository's issue tracker.

## Development

### Setup

```bash
git clone <repo-url>
cd mdtyper
npm install
```

### Build

```bash
npm run build
```

This runs esbuild with two targets and copies the webview stylesheet:
- `dist/extension.js` — extension host bundle (Node.js)
- `dist/webview.js` — webview bundle (browser, includes Milkdown)
- `dist/theme.css` — webview stylesheet (copied from `webview-src/`)

### Run in development

1. Open the `mdtyper/` folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. Open any `.md` file in the new window

After making changes, reload the Extension Development Host with `Ctrl+Shift+P` → **Developer: Reload Window**. The `--watch` mode rebuilds JS automatically:

```bash
npm run watch
```

> **Note:** `theme.css` changes are not picked up by `--watch`. After editing the stylesheet, run `npm run build` once and reload the window manually.

### Package

```bash
npm run package
```

This runs the production build (`vscode:prepublish`) and then packages everything into `mdtyper-0.0.1.vsix`.

## Architecture

MdTyper uses the VS Code [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors). When a `.md` file is opened, the extension creates a `WebviewPanel` that hosts [Milkdown](https://milkdown.dev) — a ProseMirror-based WYSIWYG Markdown editor.

```
VS Code
  └── CustomTextEditorProvider
        └── WebviewPanel
              └── Milkdown (ProseMirror + Remark)
```

Changes flow in both directions:

- **User types** → Milkdown fires `markdownUpdated` → webview posts an `edit` message → extension applies a `WorkspaceEdit` (VS Code tracks dirty state and handles save)
- **File changes externally** → `onDidChangeTextDocument` fires → extension posts an `update` message → Milkdown replaces its content

## License

MIT
