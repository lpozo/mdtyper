# YouType — WYSIWYG Markdown Editor for VS Code

A Typora-like inline WYSIWYG Markdown editing extension for VS Code. Markdown syntax is hidden as you type and rendered in place (headings, bold, lists, etc.) — no split pane.

## Language Decision

**TypeScript is required.** VSCode extensions MUST use TypeScript/JavaScript for the extension host. Python cannot run in the VS Code extension host runtime and is not used in this project.

## Architecture

```
VSCode Extension Host (TypeScript)
  └── YouTypeEditorProvider (CustomTextEditorProvider)
        └── WebviewPanel
              └── Milkdown editor (ProseMirror + Remark, WYSIWYG)
```

**Key libraries:**
- **Milkdown** (`@milkdown/kit`) — Typora-inspired WYSIWYG editor built on ProseMirror + Remark. Plugin-driven, lossless Markdown round-trip, 1.1 MB bundled.
- **esbuild** — Dual-target build: Node.js CJS for extension host, browser IIFE for webview.

**Key VS Code APIs:**
- `CustomTextEditorProvider` — routes `.md` files to YouType, VS Code handles save/dirty/undo automatically.
- `WebviewPanel` — renders Milkdown as HTML/CSS/JS inside VS Code.
- `retainContextWhenHidden: true` — keeps Milkdown alive across tab switches.

## Project Structure

```
youtype/
├── package.json              Extension manifest (contributes.customEditors)
├── tsconfig.json             Extension host config (Node16, no DOM lib)
├── tsconfig.webview.json     Webview config (ESNext, DOM lib)
├── esbuild.mjs               Dual-target build script
├── .vscodeignore             Excludes src/node_modules from .vsix
├── .gitignore
├── src/
│   ├── extension.ts          activate() — registers provider + "Reopen as Text" command
│   └── YouTypeEditorProvider.ts  Core: CustomTextEditorProvider, HTML generation, sync
├── webview-src/
│   ├── main.ts               Milkdown init + bidirectional message bridge
│   └── theme.css             VS Code token overrides + layout
├── out/                      Build artifacts (gitignored)
│   ├── extension.js          Extension host bundle (5.9 KB)
│   └── webview.js            Webview bundle (1.1 MB, Milkdown included)
└── .vscode/
    ├── launch.json           F5 → Extension Development Host
    └── tasks.json            npm watch background task
```

## Message Protocol (Extension Host ↔ Webview)

| Direction | Message | Purpose |
|-----------|---------|---------|
| Webview → Host | `{ type: 'ready' }` | Webview loaded, request document content |
| Host → Webview | `{ type: 'update', content: string }` | Send/refresh document content |
| Webview → Host | `{ type: 'edit', content: string }` | User made a change |

**Echo-loop guards:** `isUpdatingFromWebview` (in `YouTypeEditorProvider.ts`) and `isUpdatingFromHost` (in `main.ts`) prevent infinite update loops when edits propagate between the two sides.

## Development

### First-time setup

```bash
cd /home/sandbox/youtype
npm install
node esbuild.mjs
```

### Dev loop (live rebuild)

```bash
node esbuild.mjs --watch
```

Then press **F5** in VS Code to launch the Extension Development Host. After source changes, reload with `Ctrl+Shift+P` → **Developer: Reload Window**.

### Production build + packaging

```bash
node esbuild.mjs --production
npx @vscode/vsce package
# Produces: youtype-0.0.1.vsix
```

### Install locally

```bash
code --install-extension youtype-0.0.1.vsix
```

### Lint (TypeScript type-check only, no emit)

```bash
npm run lint
```

## Verification Checklist

1. **Build** — `node esbuild.mjs` produces `out/extension.js` and `out/webview.js` with no errors.
2. **Activates** — F5, open any `.md` file → YouType custom editor opens (not raw text).
3. **Renders** — Type `# Hello` → renders as a large heading with `#` hidden; dirty dot appears in tab.
4. **Saves** — Ctrl+S → dirty dot clears; file on disk contains raw Markdown (`# Hello\n`), not HTML.
5. **External sync** — Edit file from terminal → webview updates automatically.
6. **Undo** — Ctrl+Z → ProseMirror history plugin reverses last edit within the webview.
7. **Escape hatch** — Right-click tab → "Reopen Editor With..." → "Text Editor" shows raw Markdown. Also available as the **YouType: Reopen as Text Editor** command.

## Critical Implementation Notes

- **`external: ['vscode']` in `esbuild.mjs` is mandatory.** esbuild must never bundle the `vscode` module — it is a virtual module injected by the VS Code extension host runtime.
- **`acquireVsCodeApi()` must be called exactly once** per webview lifetime (stored in a module-level const in `main.ts`).
- **Use `vscode.workspace.applyEdit`** to modify the document — never `fs.writeFile`, which bypasses VS Code's undo stack and dirty tracking.
- **`retainContextWhenHidden: true`** keeps Milkdown alive across tab switches at the cost of higher memory. This is the correct default for a WYSIWYG editor.

## Optional Enhancements (post-MVP)

- **KaTeX math** — `npm install katex` + ProseMirror plugin for `$...$` / `$$...$$`
- **Mermaid diagrams** — `npm install mermaid` + node view for fenced code blocks with `` ```mermaid ``
- **Slash command toolbar** — `@milkdown/kit/plugin/slash` for heading/bold/italic shortcuts
- **Image paste** — Milkdown image upload plugin + save to `./assets/` relative to document
