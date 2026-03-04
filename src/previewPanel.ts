import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import MarkdownIt = require('markdown-it');
// @ts-ignore
import markdownItTaskLists = require('markdown-it-task-lists');
// @ts-ignore
import markdownItKatex = require('@iktakahiro/markdown-it-katex');
const hljs: any = require('highlight.js');

function injectLineNumbers(md: any) {
    const rules = ['paragraph_open', 'heading_open', 'table_open', 'blockquote_open', 'bullet_list_open', 'ordered_list_open', 'code_block', 'fence', 'math_block', 'html_block'];
    rules.forEach(rule => {
        const defaultRenderer = md.renderer.rules[rule] || function (tokens: any, idx: any, options: any, env: any, self: any) {
            return self.renderToken(tokens, idx, options);
        };
        md.renderer.rules[rule] = function (tokens: any, idx: any, options: any, env: any, self: any) {
            if (tokens[idx].map && tokens[idx].map.length) {
                tokens[idx].attrPush(['data-line', tokens[idx].map[0].toString()]);
            }
            return defaultRenderer(tokens, idx, options, env, self);
        };
    });
}
export class MarkdownPreviewPanel {
    public static currentPanel: MarkdownPreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private readonly _md: MarkdownIt;
    private lnkCache: Map<string, string> = new Map();
    private _timeout: NodeJS.Timeout | undefined;
    private _document: vscode.TextDocument;
    private _isProgrammaticReveal = false;
    private _isUserScrollingEditor = false;
    private _userScrollEditorTimeout: NodeJS.Timeout | undefined;

    public static createOrShow(extensionUri: vscode.Uri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'markdown') {
            vscode.window.showInformationMessage("请先打开一个 Markdown 文本文件再启用预览。");
            return;
        }

        const column = editor.viewColumn;
        const viewColumn = column === vscode.ViewColumn.One ? vscode.ViewColumn.Two : column;

        if (MarkdownPreviewPanel.currentPanel) {
            MarkdownPreviewPanel.currentPanel._document = editor.document;
            MarkdownPreviewPanel.currentPanel._panel.reveal(viewColumn);
            MarkdownPreviewPanel.currentPanel.triggerUpdateContent();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'mdLnkPreview',
            'Markdown 预览',
            viewColumn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        MarkdownPreviewPanel.currentPanel = new MarkdownPreviewPanel(panel, extensionUri, editor.document);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document: vscode.TextDocument) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._document = document;
        this._md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true,
            highlight: function (str, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
                    } catch (__) { }
                }
                return '';
            }
        })
            .use(markdownItTaskLists)
            .use(markdownItKatex)
            .use(injectLineNumbers);

        this.triggerUpdateContent();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document === this._document) {
                this.triggerUpdateContent();
            }
        }, null, this._disposables);

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'markdown') {
                this._document = editor.document;
                this.triggerUpdateContent();
            }
        }, null, this._disposables);

        vscode.window.onDidChangeTextEditorVisibleRanges(e => {
            if (e.textEditor.document === this._document) {
                if (this._isProgrammaticReveal) return;

                this._isUserScrollingEditor = true;
                if (this._userScrollEditorTimeout) clearTimeout(this._userScrollEditorTimeout);
                this._userScrollEditorTimeout = setTimeout(() => {
                    this._isUserScrollingEditor = false;
                }, 150);

                if (e.visibleRanges.length > 0) {
                    const topLine = e.visibleRanges[0].start.line;
                    this._panel.webview.postMessage({ command: 'syncScroll', line: topLine });
                }
            }
        }, null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'openLnk':
                        try {
                            const linkPath = decodeURIComponent(message.url);
                            let absolutePath = linkPath;

                            if (!path.isAbsolute(linkPath) && this._document) {
                                const docDir = path.dirname(this._document.uri.fsPath);
                                absolutePath = path.resolve(docDir, linkPath);
                            }

                            if (fs.existsSync(absolutePath)) {
                                execFile('explorer.exe', [absolutePath]);
                            } else {
                                vscode.window.showErrorMessage(`无法打开快捷方式，文件不存在: ${absolutePath}`);
                            }
                        } catch (e: any) {
                            vscode.window.showErrorMessage(`打开快捷方式遇到错误: ${e.message}`);
                        }
                        return;
                    case 'openLocal':
                        try {
                            const localPath = decodeURIComponent(message.url);
                            if (fs.existsSync(localPath)) {
                                execFile('explorer.exe', [localPath]);
                            }
                        } catch (e) { }
                        return;
                    case 'openLink':
                        try {
                            const url = message.url;
                            if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
                                vscode.env.openExternal(vscode.Uri.parse(url));
                            } else {
                                let cleanUrl = url.split('#')[0].split('?')[0];
                                let absolutePath = cleanUrl;
                                try { absolutePath = decodeURIComponent(cleanUrl); } catch (e) { }

                                if (!path.isAbsolute(absolutePath) && this._document) {
                                    const docDir = path.dirname(this._document.uri.fsPath);
                                    absolutePath = path.resolve(docDir, absolutePath);
                                }

                                if (fs.existsSync(absolutePath)) {
                                    const uri = vscode.Uri.file(absolutePath);
                                    const editor = vscode.window.visibleTextEditors.find(e => e.document === this._document);
                                    const column = editor ? editor.viewColumn : vscode.ViewColumn.One;
                                    vscode.commands.executeCommand('vscode.open', uri, column);
                                } else {
                                    vscode.window.showErrorMessage(`无法打开链接，文件不存在: ${absolutePath}`);
                                }
                            }
                        } catch (e) { }
                        return;
                    case 'revealLine':
                        if (this._isUserScrollingEditor) return;

                        if (this._document) {
                            const editor = vscode.window.visibleTextEditors.find(e => e.document === this._document);
                            if (editor) {
                                this._isProgrammaticReveal = true;
                                const line = message.line;
                                const range = new vscode.Range(line, 0, line, 0);
                                editor.revealRange(range, vscode.TextEditorRevealType.AtTop);

                                setTimeout(() => {
                                    this._isProgrammaticReveal = false;
                                }, 100);
                            }
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private triggerUpdateContent() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(() => {
            if (!this._panel) return;
            this.updateContentAsync();
        }, 150);
    }

    private async bulkResolveLnkAsync(lnkPaths: string[]): Promise<void> {
        const toResolve = lnkPaths.filter(p => !this.lnkCache.has(p) && fs.existsSync(p));
        if (toResolve.length === 0) return;

        return new Promise((resolve) => {
            const scriptLines = [
                '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
                '$wshell = New-Object -ComObject WScript.Shell'
            ];

            for (const p of toResolve) {
                const escaped = p.replace(/'/g, "''");
                scriptLines.push(`Write-Output ($wshell.CreateShortcut('${escaped}').TargetPath)`);
            }
            const script = scriptLines.join('; ');

            execFile('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }, (err, stdout) => {
                if (stdout) {
                    const lines = stdout.replace(/\r/g, '').split('\n');
                    for (let i = 0; i < toResolve.length; i++) {
                        const target = (lines[i] || '').trim();
                        if (target && fs.existsSync(target)) {
                            this.lnkCache.set(toResolve[i], target);
                        } else {
                            this.lnkCache.set(toResolve[i], toResolve[i]);
                        }
                    }
                }
                resolve();
            });
        });
    }

    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.png': return 'image/png';
            case '.jpg':
            case '.jpeg': return 'image/jpeg';
            case '.gif': return 'image/gif';
            case '.webp': return 'image/webp';
            case '.svg': return 'image/svg+xml';
            case '.bmp': return 'image/bmp';
            case '.ico': return 'image/x-icon';
            default: return 'application/octet-stream';
        }
    }

    private async updateContentAsync() {
        if (!this._document) {
            return;
        }

        let debugLogHtml = "";

        try {
            const docDir = path.dirname(this._document.uri.fsPath);
            let text = this._document.getText();

            // KaTeX patch: replace \begin{align} with \begin{aligned} to support multiline equations
            text = text.replace(/\\begin\{align([*]?)\}/g, '\\begin{aligned}')
                .replace(/\\end\{align([*]?)\}/g, '\\end{aligned}');

            let htmlContent = this._md.render(text);

            const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/g;
            let match;
            const replacements: { original: string, newStr: string }[] = [];

            // Run an initial quick pass to gather all LNKs that need bulk resolution
            const lnkPaths = new Set<string>();
            let tempHtml = htmlContent;
            while ((match = imgRegex.exec(tempHtml)) !== null) {
                let src = match[2];
                if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) continue;
                let decodedSrc = src;
                try { decodedSrc = decodeURIComponent(src); } catch (e) { }
                const absolutePath = path.isAbsolute(decodedSrc) ? decodedSrc : path.resolve(docDir, decodedSrc);
                if (absolutePath.toLowerCase().endsWith('.lnk')) {
                    lnkPaths.add(absolutePath);
                }
            }

            // Power-up phase: batch resolve all LNK targets in exactly ONE PowerShell spawn!
            await this.bulkResolveLnkAsync(Array.from(lnkPaths));

            // Actual replacement pass
            imgRegex.lastIndex = 0;
            while ((match = imgRegex.exec(htmlContent)) !== null) {
                const originalMatch = match[0];
                const prefix = match[1];
                let src = match[2];
                const suffix = match[3];

                if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
                    continue;
                }

                try {
                    let decodedSrc = src;
                    try { decodedSrc = decodeURIComponent(src); } catch (e) { }
                    const absolutePath = path.isAbsolute(decodedSrc) ? decodedSrc : path.resolve(docDir, decodedSrc);

                    let targetPath = absolutePath;
                    if (absolutePath.toLowerCase().endsWith('.lnk')) {
                        targetPath = this.lnkCache.get(absolutePath) || absolutePath;
                    }

                    if (fs.existsSync(targetPath)) {
                        const fileData = fs.readFileSync(targetPath);
                        const base64Data = fileData.toString('base64');
                        const mimeType = this.getMimeType(targetPath);
                        const dataUri = `data:${mimeType};base64,${base64Data}`;

                        replacements.push({
                            original: originalMatch,
                            newStr: `<a data-path="${encodeURIComponent(absolutePath)}" style="cursor:pointer;"><img${prefix}src="${dataUri}"${suffix} title="点击打开大图" /></a>`
                        });
                    } else {
                        // Include debugging info right on the broken image for the user to see!
                        replacements.push({
                            original: originalMatch,
                            newStr: `<div style="border: 1px solid red; padding: 10px; color: red;"><b>Image Failed:</b><br/>Original src: ${src}<br/>Decoded: ${decodedSrc}<br/>Resolved Lnk Target: ${targetPath}<br/>Exists: false</div>`
                        });
                    }
                } catch (err: any) {
                    debugLogHtml += `<p style="color:red;">Error processing image ${src}: ${err.message}</p>`;
                }
            }

            for (const rep of replacements) {
                htmlContent = htmlContent.replace(rep.original, rep.newStr);
            }

            this._panel.title = `Preview ${path.basename(this._document.fileName)}`;

            // Append visual error logs if any occurred
            if (debugLogHtml) {
                htmlContent = `<div style="background-color: #ffcccc; color: #cc0000; padding: 10px; margin-bottom: 20px; border-radius: 5px;"><h3>Debug Logs</h3>${debugLogHtml}</div>` + htmlContent;
            }

            this._panel.webview.html = this.getHtmlForWebview(htmlContent);

        } catch (error: any) {
            this._panel.webview.html = `<h2>Render Critical Error</h2><p>${error.message}</p><pre>${error.stack}</pre>`;
        }
    }

    private getHtmlForWebview(bodyHtml: string): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Preview</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
                <style id="hljs-style"></style>
                <style>
                    body {
                        font-family: var(--vscode-markdown-font-family, -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", "Ubuntu", "Droid Sans", sans-serif);
                        font-size: var(--vscode-markdown-font-size, 16px);
                        line-height: var(--vscode-markdown-line-height, 1.8);
                        padding: 0 20px 20px 20px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    a { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; }
                    a:hover { text-decoration: underline; }
                    img { max-width: 100%; border-radius: 4px; }
                    code {
                        color: var(--vscode-textPreformat-foreground, inherit);
                        padding: 2px 4px;
                        border-radius: 3px;
                        font-size: 14.5px;
                        font-family: var(--vscode-editor-font-family, Consolas, "Courier New", monospace);
                    }
                    pre {
                        padding: 16px;
                        border-radius: 6px;
                        overflow-x: auto;
                    }
                    pre code { background-color: transparent !important; padding: 0; color: inherit; }
                    
                    body.vscode-light code, body.vscode-light pre { background-color: rgba(0, 0, 0, 0.05); }
                    body.vscode-dark code, body.vscode-dark pre, body.vscode-high-contrast code, body.vscode-high-contrast pre { background-color: rgba(0, 0, 0, 0.35); }

                    blockquote {
                        border-left: 4px solid var(--vscode-textBlockQuote-border, #777);
                        padding: 8px 15px;
                        margin: 15px 0;
                        color: var(--vscode-textBlockQuote-foreground, inherit);
                    }
                    body.vscode-light blockquote { background-color: rgba(0, 0, 0, 0.03); }
                    body.vscode-dark blockquote, body.vscode-high-contrast blockquote { background-color: rgba(0, 0, 0, 0.2); }
                    blockquote > :first-child { margin-top: 0; }
                    blockquote > :last-child { margin-bottom: 0; }
                    
                    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
                    th, td { border: 1px solid var(--vscode-panel-border, #555); padding: 8px 13px; }
                    body.vscode-light th { background-color: rgba(0, 0, 0, 0.05); }
                    body.vscode-dark th, body.vscode-high-contrast th { background-color: rgba(0, 0, 0, 0.2); }
                    
                    hr { border: 0; border-bottom: 1px solid var(--vscode-panel-border, #555); margin: 24px 0; }
                    h1, h2 { border-bottom: 1px solid var(--vscode-panel-border, #555); padding-bottom: 0.3em; margin-top: 24px; }
                    
                    /* Task Lists Style */
                    .task-list-item { list-style-type: none; }
                    .task-list-item-checkbox {
                        margin: 0 0.5em 0.25em -1.4em;
                        vertical-align: middle;
                        opacity: 1 !important;
                        appearance: none;
                        -webkit-appearance: none;
                        width: 14px;
                        height: 14px;
                        border: 1px solid var(--vscode-checkbox-border, var(--vscode-editor-foreground));
                        border-radius: 3px;
                        background-color: var(--vscode-checkbox-background, transparent);
                        position: relative;
                        outline: none;
                        cursor: default;
                    }
                    .task-list-item-checkbox:checked {
                        background-color: var(--vscode-button-background, #007acc);
                        border-color: var(--vscode-button-background, #007acc);
                    }
                    .task-list-item-checkbox:checked::after {
                        content: '';
                        position: absolute;
                        left: 4px;
                        top: 1px;
                        width: 3px;
                        height: 7px;
                        border: solid var(--vscode-button-foreground, #fff);
                        border-width: 0 2px 2px 0;
                        transform: rotate(45deg);
                    }
                </style>
            </head>
            <body>
                ${bodyHtml}
                
                <script>
                    function updateTheme() {
                        const styleNode = document.getElementById('hljs-style');
                        if (document.body.classList.contains('vscode-light')) {
                            styleNode.textContent = '@import url("https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/styles/github.min.css");';
                        } else {
                            styleNode.textContent = '@import url("https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/styles/github-dark.min.css");';
                        }
                    }
                    
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.attributeName === 'class') {
                                updateTheme();
                            }
                        });
                    });
                    
                    window.addEventListener('DOMContentLoaded', () => {
                        updateTheme();
                        observer.observe(document.body, { attributes: true });
                    });

                    const vscode = acquireVsCodeApi();
                    
                    let cachedElements = null;
                    function getElements() {
                        if (!cachedElements) {
                            cachedElements = Array.from(document.querySelectorAll('[data-line]')).sort((a,b) => parseInt(a.getAttribute('data-line'), 10) - parseInt(b.getAttribute('data-line'), 10));
                        }
                        return cachedElements;
                    }

                    let isProgrammaticScroll = false;
                    let isUserScrolling = false;
                    let userScrollTimeout = null;

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'syncScroll') {
                            if (isUserScrolling) return;

                            const line = message.line;
                            let elements = getElements();
                            if (elements.length === 0) return;
                            
                            let previous = null;
                            let next = null;
                            let previousLine = -1;
                            let nextLine = Infinity;

                            for (let i = 0; i < elements.length; i++) {
                                let elLine = parseInt(elements[i].getAttribute('data-line'), 10);
                                if (elLine <= line && elLine > previousLine) {
                                    previousLine = elLine;
                                    previous = elements[i];
                                }
                                if (elLine > line) {
                                    nextLine = elLine;
                                    next = elements[i];
                                    break;
                                }
                            }

                            let targetScrollY = 0;
                            const getTopY = (el) => window.scrollY + el.getBoundingClientRect().top;

                            if (!previous && next) {
                                targetScrollY = 0;
                            } else if (previous && !next) {
                                targetScrollY = getTopY(previous);
                            } else if (previous && next) {
                                let prevY = getTopY(previous);
                                let nextY = getTopY(next);
                                let fraction = (line - previousLine) / Math.max(1, (nextLine - previousLine));
                                targetScrollY = prevY + fraction * (nextY - prevY);
                            }

                            isProgrammaticScroll = true;
                            window.scrollTo({
                                top: Math.max(0, targetScrollY),
                                behavior: 'auto'
                            });
                            if (window.syncScrollTimeout) clearTimeout(window.syncScrollTimeout);
                            window.syncScrollTimeout = setTimeout(() => { isProgrammaticScroll = false; }, 50);
                        }
                    });

                    let scrollTimeout;
                    window.addEventListener('scroll', () => {
                        if (isProgrammaticScroll) return;

                        isUserScrolling = true;
                        if (userScrollTimeout) clearTimeout(userScrollTimeout);
                        userScrollTimeout = setTimeout(() => { isUserScrolling = false; }, 150);

                        if (scrollTimeout) {
                            cancelAnimationFrame(scrollTimeout);
                        }
                        scrollTimeout = requestAnimationFrame(() => {
                            const elements = getElements();
                            if (elements.length === 0) return;

                            const scrollY = window.scrollY;
                            const getTopY = (el) => window.scrollY + el.getBoundingClientRect().top;

                            let previous = null;
                            let next = null;

                            for (let i = 0; i < elements.length; i++) {
                                if (getTopY(elements[i]) <= scrollY) {
                                    previous = elements[i];
                                } else {
                                    next = elements[i];
                                    break;
                                }
                            }

                            let line = 0;
                            if (!previous && next) {
                                line = 0;
                            } else if (previous && !next) {
                                line = parseInt(previous.getAttribute('data-line'), 10);
                            } else if (previous && next) {
                                let prevY = getTopY(previous);
                                let nextY = getTopY(next);
                                let prevLine = parseInt(previous.getAttribute('data-line'), 10);
                                let nextLine = parseInt(next.getAttribute('data-line'), 10);
                                let fraction = Math.max(0, Math.min(1, (scrollY - prevY) / Math.max(1, nextY - prevY)));
                                line = prevLine + fraction * (nextLine - prevLine);
                            }

                            line = Math.round(line);
                            if (!isNaN(line)) {
                                vscode.postMessage({ command: 'revealLine', line: line });
                            }
                        });
                    });

                    document.addEventListener('click', event => {
                        let node = event.target;
                        while (node) {
                            if (node.tagName && node.tagName.toLowerCase() === 'a') {
                                const href = node.getAttribute('href');
                                if (href && href.startsWith('#')) {
                                    return;
                                }

                                event.preventDefault();
                                const dataPath = node.getAttribute('data-path');
                                if (dataPath) {
                                    const decoded = decodeURIComponent(dataPath);
                                    if (decoded.toLowerCase().endsWith('.lnk')) {
                                        vscode.postMessage({ command: 'openLnk', url: dataPath });
                                    } else {
                                        vscode.postMessage({ command: 'openLocal', url: dataPath });
                                    }
                                    return;
                                }

                                if (href) {
                                    try {
                                        let cleanHref = href.split('?')[0].split('#')[0];
                                        try { cleanHref = decodeURIComponent(cleanHref); } catch(e) {}
                                        if (cleanHref.toLowerCase().endsWith('.lnk')) {
                                            vscode.postMessage({ command: 'openLnk', url: href });
                                        } else {
                                            vscode.postMessage({ command: 'openLink', url: href });
                                        }
                                    } catch (e) {
                                        vscode.postMessage({ command: 'openLink', url: href });
                                    }
                                }
                                return;
                            }
                            node = node.parentNode;
                        }
                    }, true);
                </script>
            </body>
            </html>`;
    }

    public dispose() {
        MarkdownPreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        if (this._timeout) clearTimeout(this._timeout);
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
