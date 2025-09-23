"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImage = void 0;
const vscode = require("vscode");
const vscode_1 = require("vscode");
const WORKFLOW_TEMPLATE = {
    "3": {
        "inputs": {
            "text": "negative prompt",
            "clip": ["4", 0]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Prompt)"
        }
    },
    "4": {
        "inputs": {
            "ckpt_name": "sd15.safetensors"
        },
        "class_type": "CheckpointLoaderSimple",
        "_meta": {
            "title": "Load Checkpoint"
        }
    },
    "5": {
        "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
        },
        "class_type": "EmptyLatentImage",
        "_meta": {
            "title": "Empty Latent Image"
        }
    },
    "6": {
        "inputs": {
            "text": "a beautiful landscape",
            "clip": ["4", 0]
        },
        "class_type": "CLIPTextEncode",
        "_meta": {
            "title": "CLIP Text Encode (Prompt)"
        }
    },
    "7": {
        "inputs": {
            "seed": 123456789,
            "steps": 20,
            "cfg": 8,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 1,
            "model": ["4", 0],
            "positive": ["6", 0],
            "negative": ["3", 0],
            "latent_image": ["5", 0]
        },
        "class_type": "KSampler",
        "_meta": {
            "title": "KSampler"
        }
    },
    "8": {
        "inputs": {
            "samples": ["7", 0],
            "vae": ["4", 2]
        },
        "class_type": "VAEDecode",
        "_meta": {
            "title": "VAE Decode"
        }
    },
    "9": {
        "inputs": {
            "filename_prefix": "ComfyUI",
            "images": ["8", 0]
        },
        "class_type": "SaveImage",
        "_meta": {
            "title": "Save Image"
        }
    },
    "links": [
        ["4", 0, "6", 1],
        ["4", 0, "3", 1],
        ["5", 0, "7", 3],
        ["6", 0, "7", 1],
        ["3", 0, "7", 2],
        ["4", 0, "7", 0],
        ["7", 0, "8", 0],
        ["4", 2, "8", 1],
        ["8", 0, "9", 0]
    ],
    "version": 0.4
};
async function generateImage(prompt, serverUrl, apiKey) {
    try {
        // Validate server URL
        if (!serverUrl || !serverUrl.startsWith('http')) {
            throw new Error('Invalid server URL. Must be a valid HTTP URL.');
        }
        // Build workflow
        const workflow = JSON.parse(JSON.stringify(WORKFLOW_TEMPLATE));
        workflow[6].inputs.text = prompt;
        // Prepare payload
        const payload = {
            prompt: workflow,
            client_id: 'vscode-extension'
        };
        if (apiKey) {
            payload.extra_data = { api_key_comfy_org: apiKey };
        }
        // POST to /prompt
        const promptResponse = await fetch(`${serverUrl}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!promptResponse.ok) {
            throw new Error(`Failed to submit prompt: ${promptResponse.statusText}`);
        }
        const promptData = await promptResponse.json();
        const promptId = promptData.prompt_id;
        if (!promptId) {
            throw new Error('No prompt ID received from server.');
        }
        // Poll /history/{promptId} every 2s, up to 5min (300s)
        const maxAttempts = 150; // 300 / 2
        let attempts = 0;
        let historyData = null;
        while (attempts < maxAttempts) {
            const historyResponse = await fetch(`${serverUrl}/history/${promptId}`);
            if (!historyResponse.ok) {
                throw new Error(`Failed to fetch history: ${historyResponse.statusText}`);
            }
            historyData = await historyResponse.json();
            const status = historyData[promptId]?.status;
            if (status === 'completed') {
                break;
            }
            else if (status === 'failed') {
                throw new Error('Prompt execution failed on server.');
            }
            // Wait 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }
        if (!historyData || !historyData[promptId]) {
            throw new Error('Timeout: Prompt did not complete within 5 minutes.');
        }
        const outputs = historyData[promptId].outputs;
        if (!outputs || !outputs[9] || !outputs[9].images || outputs[9].images.length === 0) {
            throw new Error('No image generated in outputs.');
        }
        const filename = outputs[9].images[0].filename;
        if (!filename) {
            throw new Error('No filename in image output.');
        }
        // Fetch image
        const viewResponse = await fetch(`${serverUrl}/view?filename=${filename}&subfolder=&type=output`);
        if (!viewResponse.ok) {
            throw new Error(`Failed to fetch image: ${viewResponse.statusText}`);
        }
        const imageBuffer = await viewResponse.arrayBuffer();
        // Save to workspace root
        const timestamp = Date.now();
        const imagePath = vscode_1.Uri.file(`comfyui_generated_${timestamp}.png`);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open.');
        }
        const fullPath = vscode_1.Uri.joinPath(workspaceFolder.uri, imagePath.path);
        await vscode.workspace.fs.writeFile(fullPath, new Uint8Array(imageBuffer));
        return fullPath.fsPath;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        else {
            throw new Error(`Unexpected error: ${error}`);
        }
    }
}
exports.generateImage = generateImage;
//# sourceMappingURL=comfyui.js.map