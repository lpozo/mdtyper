# Changelog

All notable changes to MdTyper are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.0.1]

### Added
- Initial release: Typora-inspired WYSIWYG Markdown editor powered by [Milkdown](https://milkdown.dev)
- Full CommonMark + GFM support: headings, bold, italic, strikethrough, lists, task lists, tables, links, images, code blocks, blockquotes
- VS Code theme-aware styling — editor colours follow your active theme
- Bidirectional sync with the underlying `.md` file: external edits update the editor, editor edits update the file
- Dirty tracking, save (Ctrl+S), and undo/redo (Ctrl+Z / Ctrl+Shift+Z) via VS Code's native document model
- **MdTyper: Reopen as Text Editor** command to escape to raw Markdown at any time
