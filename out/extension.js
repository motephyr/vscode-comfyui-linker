"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const comfyui_1 = require("./comfyui");
function activate(context) {
    const disposable = vscode.commands.registerCommand('comfyui.generateImage', async () => {
        const config = vscode.workspace.getConfiguration('comfyui');
        console.log('Retrieved workflowTemplate from config:', config.get('workflowTemplate'));
        const prompt = await vscode.window.showInputBox({
            prompt: 'Enter your image generation prompt',
            placeHolder: 'e.g., a beautiful landscape',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Prompt cannot be empty.';
                }
                return null;
            }
        });
        if (!prompt) {
            return;
        }
        try {
            vscode.window.showInformationMessage('Generating image with ComfyUI...');
            const filenames = await (0, comfyui_1.generateImage)(prompt, config);
            const message = `Image(s) generated and saved: ${filenames.join(', ')}`;
            vscode.window.showInformationMessage(message);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            vscode.window.showErrorMessage(`Failed to generate image: ${message}`);
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map