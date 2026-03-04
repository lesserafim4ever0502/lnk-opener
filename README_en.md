# Lnk Opener & Markdown Preview

English | [简体中文](./README.md)

A VSCode extension that supports opening Windows `.lnk` shortcuts and provides a Markdown preview experience.

## 🌟 Core Features

### 1. Native Shortcut Launching
Whether double-clicking a `.lnk` file in the Explorer, or clicking a link pointing to a `.lnk` in the Markdown preview, this extension invokes the native Windows system (`explorer.exe`) to open the target program or directory.

### 2. Markdown Preview Features
Click the 🔥 (flame) icon in the top right corner of the editor to launch an independent Markdown preview:
- **Shortcut Image Rendering**: If you reference `.lnk` paths pointing to local images in your Markdown, the extension resolves the shortcut and renders the real image in the preview.
- **Bi-Directional Scroll Sync**: Supports double-sided scrolling synchronization between the source code and preview areas. It utilizes a top-alignment mechanism and includes debouncing logic to prevent scroll conflicts.
- **Math Equation Support**: Integrates the KaTeX engine to support rendering of inline equations `$...$` and multiline equation blocks `$$...$$`.
- **Adaptive Theme Integration**: Compatible with VSCode's Light / Dark / High Contrast themes. Code block highlights and backgrounds switch automatically based on system preferences.
- **Extended Syntax Support**: Supports GitHub Flavored Task Lists (`- [x]`) rendering along with standard Markdown syntaxes.

## 🚀 Background
When organizing local files, users may rely on Windows shortcuts (`.lnk`). The native VSCode Markdown Preview does not parse `.lnk` files. The main purpose of this project is to provide a preview solution capable of resolving `.lnk` files natively, while making up for basic usability enhancements like math equation support and theme adaptability.

## ⚙️ Quick Start
1. Open any `.md` file.
2. Click the **flame icon `$(flame)`** (Markdown Preview (lnk support)) in the top right corner of the editor to launch the dedicated preview.
3. Scroll the page to see the scrolling sync effects.

## 🔧 Troubleshooting
If an image displays a red error box, check the prompt inside the error block to see the exact image path and resolution error. Verify whether the source file pointed to by the `.lnk` shortcut has been moved or deleted.
