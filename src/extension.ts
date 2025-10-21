import * as vscode from 'vscode';
import { generateImage, generateImageFromImage } from './comfyui';

let previewPanel: vscode.WebviewPanel | undefined;
let outputChannel: vscode.OutputChannel;

const INITIAL_HTML = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ComfyUI Preview</title>
  </head>
  <body>
    <h1>Generating Image...</h1>
    <div id="progress-container" style="margin: 20px 0;">
      <div style="margin-bottom: 10px; font-size: 16px;">Percentage: <span id="progress-text">0%</span></div>
      <div style="width: 100%; background-color: #ddd; height: 20px; border-radius: 10px;">
        <div id="progress-bar" style="width: 0%; background-color: #4CAF50; height: 20px; border-radius: 10px; transition: width 0.3s ease-in-out;"></div>
      </div>
    </div>
    <img id="previewImage" style="max-width: 100%; display: none;" alt="Preview Image" />
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'progress':
            const percentage = message.percentage;
            document.getElementById('progress-text').innerText = percentage + '%';
            document.getElementById('progress-bar').style.width = percentage + '%';
            break;
          case 'preview':
            const img = document.getElementById('previewImage');
            img.src = message.dataUrl;
            img.style.display = 'block';
            document.querySelector('h1').style.display = 'none';
            document.getElementById('progress-container').style.display = 'none';
            break;
        }
      });
    </script>
  </body>
  </html>
`;

function getOrCreatePanel(): vscode.WebviewPanel {
  if (previewPanel) {
    previewPanel.webview.html = INITIAL_HTML;
    return previewPanel;
  }

  const panel = vscode.window.createWebviewPanel(
    'comfyuiPreview',
    'ComfyUI Preview',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  previewPanel = panel;

  panel.onDidDispose(() => {
    previewPanel = undefined;
  });

  panel.webview.html = INITIAL_HTML;

  return panel;
}

let commandRegistered = false;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('ComfyUI Linker');
  const commandId = 'comfyui.generateImage';

  if (!commandRegistered) {
    commandRegistered = true;
    const disposable = vscode.commands.registerCommand(commandId, async () => {
      // Validate workspace
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a folder to save generated images.');
        return;
      }

      const config = vscode.workspace.getConfiguration('comfyui');
      console.log('Retrieved workflowTemplate from config:', config.get('workflowTemplate'));

      // Prompt for serverUrl if not set
      let serverUrl = config.get<string>('serverUrl');
      if (!serverUrl) {
        serverUrl = await vscode.window.showInputBox({
          prompt: 'Enter ComfyUI server URL',
          placeHolder: 'e.g., http://localhost:8188',
          validateInput: (value) => {
            if (!value || !value.startsWith('http')) {
              return 'Server URL must be a valid HTTP URL.';
            }
            return null;
          }
        });
        if (!serverUrl) {
          return;
        }
        // Save to config
        await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Workspace);
      }

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

      const panel = getOrCreatePanel();

      // Define callbacks
      const updatePreview = (dataUrl: string) => {
        panel.webview.postMessage({ command: 'preview', dataUrl });
      };
    
      const updateProgress = (progress: number) => {
        const percentage = Math.round(progress * 100);
        panel.webview.postMessage({ command: 'progress', percentage });
      };

      try {
        vscode.window.showInformationMessage('Generating image with ComfyUI...');
        const filenames = await generateImage(prompt, config, updatePreview, updateProgress, outputChannel);
        const message = `Image(s) generated and saved: ${filenames.join(', ')}`;
        vscode.window.showInformationMessage(message);
        panel.reveal(vscode.ViewColumn.One);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        vscode.window.showErrorMessage(`Failed to generate image: ${message}`);
        // Optionally dispose panel on error
        // panel.dispose();
      }
    });

    const img2imgDisposable = vscode.commands.registerCommand('comfyui.generateImageFromImage', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a folder to save generated images.');
        return;
      }

      const config = vscode.workspace.getConfiguration('comfyui');

      const imageUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Select Image',
        filters: { 'Images': ['png', 'jpg', 'jpeg', 'webp'] }
      });

      if (!imageUri || imageUri.length === 0) {
        return;
      }

      const imagePath = imageUri[0].fsPath;

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

      const panel = getOrCreatePanel();

      const updatePreview = (dataUrl: string) => {
        panel.webview.postMessage({ command: 'preview', dataUrl });
      };

      const updateProgress = (progress: number) => {
        const percentage = Math.round(progress * 100);
        panel.webview.postMessage({ command: 'progress', percentage });
      };

      try {
        vscode.window.showInformationMessage('Generating image with ComfyUI...');
        const filenames = await generateImageFromImage(prompt, imagePath, config, updatePreview, updateProgress, outputChannel);
        const message = `Image(s) generated and saved: ${filenames.join(', ')}`;
        vscode.window.showInformationMessage(message);
        panel.reveal(vscode.ViewColumn.One);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        vscode.window.showErrorMessage(`Failed to generate image: ${message}`);
      }
    });

    context.subscriptions.push(disposable, img2imgDisposable);

  }
}

export function deactivate() {}