"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const previewPanel_1 = require("./previewPanel");
function activate(context) {
    // 1. 保留原有功能：当用户在传统编辑器面板直接打开 .lnk 时，捕获并用系统默认打开
    const provider = new LnkEditorProvider();
    context.subscriptions.push(vscode.window.registerCustomEditorProvider('lnkOpener.editor', provider, {
        webviewOptions: { retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: false
    }));
    // 2. 新增功能：注册自定义的增强型 Markdown 预览面板命令
    context.subscriptions.push(vscode.commands.registerCommand('lnkOpener.showPreview', () => {
        previewPanel_1.MarkdownPreviewPanel.createOrShow(context.extensionUri);
    }));
}
class LnkEditorProvider {
    async openCustomDocument(uri, openContext, token) {
        return { uri, dispose: () => { } };
    }
    async resolveCustomEditor(document, webviewPanel, token) {
        const filePath = document.uri.fsPath;
        (0, child_process_1.exec)(`cmd.exe /c start "" "${filePath}"`, (error) => {
            if (error) {
                vscode.window.showErrorMessage(`无法打开快捷方式: ${error.message}`);
            }
        });
        setTimeout(() => webviewPanel.dispose(), 100);
    }
}
//# sourceMappingURL=extension.js.map