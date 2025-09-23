# VSCode ComfyUI Linker

A Visual Studio Code extension that allows you to generate images using a ComfyUI server directly from your editor.

## Features

- Generate images from text prompts using a ComfyUI backend.
- Configurable server URL and optional API key for hosted instances.
- Saves generated images as PNG files in the workspace root.
- Simple command-based interface with input validation.

## Requirements

- VS Code 1.80.0 or higher.
- A running ComfyUI server (default: http://localhost:8188) with Stable Diffusion 1.5 model loaded.
- The server must support the standard ComfyUI API endpoints (/prompt, /history, /view).

## Installation

### From VSIX Package

1. Install the VS Code Extension Manager if not already installed.
2. Run `npm install -g vsce` to install the VSCE tool globally.
3. Package the extension: `vsce package` (run this in the extension root directory).
4. Install the generated `.vsix` file via VS Code: Extensions view > ... > Install from VSIX.

### Development Installation

1. Clone or extract the extension files.
2. Open the folder in VS Code.
3. Press `F5` to compile and run in Extension Development Host.
4. Reload the window and activate the extension.

## Configuration

Open VS Code settings (Cmd/Ctrl + ,) and search for "ComfyUI".

- **comfyui.serverUrl**: The URL of your ComfyUI server (default: `http://localhost:8188`).
- **comfyui.apiKey**: Optional API key for hosted ComfyUI services (e.g., Comfy.org).

## Usage

1. Ensure your ComfyUI server is running and accessible.
2. Open the Command Palette (Cmd/Ctrl + Shift + P).
3. Run the command: **Generate Image with ComfyUI**.
4. Enter your text prompt (e.g., "a beautiful landscape").
5. Wait for generation (up to 5 minutes). The extension polls the server every 2 seconds.
6. On success, the image is saved to the workspace root as `comfyui_generated_[timestamp].png`.
7. A notification confirms the file path.

### Example Workflow

The extension uses a minimal hardcoded workflow for text-to-image generation:
- Checkpoint Loader (SD 1.5).
- CLIP Text Encode for positive/negative prompts.
- Empty Latent Image (512x512).
- KSampler (20 steps, Euler sampler).
- VAE Decode and Save Image.

Images are fetched and saved using VS Code's workspace FS API.

## Troubleshooting

- **Network Errors**: Verify server URL and ensure the server is running.
- **No Image Generated**: Check server logs; ensure the model is loaded and workflow is valid.
- **Timeout**: Increase polling if needed (hardcoded to 5 min); check server performance.
- **API Key Issues**: For hosted servers, confirm key format and permissions.
- **Fetch Errors**: Ensure VS Code is on a recent version supporting native fetch.

## Limitations

- Fixed workflow (512x512, 20 steps, basic sampler).
- No advanced ComfyUI features (e.g., custom workflows, upscaling).
- Assumes single image output from node 9.
- No preview in VS Code; open the saved PNG in an image viewer.

## Development

- Compile: `npm run compile`.
- Watch: `npm run watch`.
- Package: `vsce package`.

For issues or contributions, see the source code in `src/`.

---

Version 0.0.1 | Built with TypeScript and VS Code API.