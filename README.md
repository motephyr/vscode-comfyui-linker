# ComfyUI Linker

A VSCode extension that enables seamless image generation using ComfyUI workflows directly within your development environment. Enter text prompts to create AI-generated images, preview them in real-time, and save outputs to your workspace. Ideal for developers integrating AI tools into their workflows.

## Features

- **Prompt-Based Image Generation**: Use simple text prompts to generate images via ComfyUI's Stable Diffusion workflows, with support for custom node configurations.
- **Real-Time Previews and Progress**: WebSocket integration provides live updates on generation progress and intermediate image previews in a dedicated VSCode panel.
- **Automatic Workspace Saving**: Generated images are saved directly to your open workspace folder with unique timestamps for easy organization.
- **Configurable Server Integration**: Connect to local or hosted ComfyUI servers (e.g., via API keys), with customizable workflow templates for advanced users.
- **Multiple Commands**: Generate, preview, or save images using dedicated VSCode commands, activated on demand.

## Installation

1. **From VSCode Marketplace** (Recommended):
   - Open VSCode.
   - Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS).
   - Search for "ComfyUI Linker".
   - Click Install.

2. **From VSIX File**:
   - Download the `.vsix` file from the [GitHub Releases](https://github.com/yi-juwu/vscode-comfyui-linker/releases).
   - In VSCode, go to Extensions > ... > Install from VSIX... and select the file.

After installation, reload VSCode if prompted.

## Usage

1. **Prerequisites Setup**:
   - Ensure a ComfyUI server is running (default: `http://localhost:8188`).
   - Open a workspace folder in VSCode where images will be saved.

2. **Generate an Image**:
   - Run the command `ComfyUI Linker: Generate Image` (via Command Palette: `Ctrl+Shift+P` or `Cmd+Shift+P`).
   - Enter your text prompt (e.g., "a beautiful landscape").
   - The extension will connect to the server, show progress in a preview panel, and save the image(s) to your workspace.

3. **Preview an Image**:
   - Run `ComfyUI Linker: Preview Image`.
   - Enter a prompt to generate and view the image in the preview panel without saving.

4. **Save an Image**:
   - Run `ComfyUI Linker: Save Image`.
   - Enter a prompt; the image will be generated and saved to the workspace.

Images are saved as PNG files with prefixes like `comfyui_saved_` or `comfyui_preview_generated_`.

For custom workflows, edit the `comfyui.workflowTemplate` in VSCode settings (JSON format).

## Requirements

- **VSCode**: Version 1.80.0 or higher.
- **ComfyUI Server**: A running instance (local or remote) with Stable Diffusion models loaded. Install via [ComfyUI GitHub](https://github.com/comfyanonymous/ComfyUI).
- **Node.js**: Not required for usage, but needed if building from source.
- Open a workspace folder to enable image saving.

## Contributing

Contributions are welcome! Please:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details (create one if needed).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

[![Version](https://vsmarketplacebadge.apphb.com/version/yi-juwu.vscode-comfyui-linker.svg)](https://marketplace.visualstudio.com/items?itemName=yi-juwu.vscode-comfyui-linker)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)