import * as vscode from 'vscode';
import { exec } from 'child_process';
import { MarkdownPreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
    // 1. 保留原有功能：当用户在传统编辑器面板直接打开 .lnk 时，捕获并用系统默认打开
    const provider = new LnkEditorProvider();
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider('lnkOpener.editor', provider, {
            webviewOptions: { retainContextWhenHidden: false },
            supportsMultipleEditorsPerDocument: false
        })
    );

    // 2. 新增功能：注册自定义的增强型 Markdown 预览面板命令
    context.subscriptions.push(
        vscode.commands.registerCommand('lnkOpener.showPreview', () => {
            MarkdownPreviewPanel.createOrShow(context.extensionUri);
        })
    );
}

class LnkEditorProvider implements vscode.CustomReadonlyEditorProvider {
    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        const filePath = document.uri.fsPath;
        
        exec(`cmd.exe /c start "" "${filePath}"`, (error) => {
            if (error) {
                vscode.window.showErrorMessage(`无法打开快捷方式: ${error.message}`);
            }
        });

        setTimeout(() => webviewPanel.dispose(), 100);
    }
}
