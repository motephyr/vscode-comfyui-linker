import * as vscode from 'vscode';
import { Uri } from 'vscode';
import * as ws from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Manages WebSocket connection to ComfyUI server for real-time progress and preview updates.
 * Handles reconnection logic and message parsing for progress and PreviewImage outputs.
 */
class WebSocketManager {
  private ws: ws.WebSocket | null = null;
  private url: string;
  private promptId: string;
  private onPreviewCallback?: (dataUrl: string) => void;
  private onProgressCallback?: (progress: number) => void;
  private workspaceDir?: string;
  private onSavePreviewCallback?: (filename: string) => void;
  private onCompleteCallback?: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(
    serverUrl: string,
    promptId: string,
    onPreview?: (dataUrl: string) => void,
    onProgress?: (progress: number) => void,
    workspaceDir?: string,
    onSavePreview?: (filename: string) => void,
    onComplete?: () => void
  ) {
    const wsBase = serverUrl
    console.log('wsBase',wsBase)
    this.url = `${wsBase}/ws?clientId=${promptId}`;
    this.promptId = promptId;
    this.onPreviewCallback = onPreview;
    this.onProgressCallback = onProgress;
    this.workspaceDir = workspaceDir;
    this.onSavePreviewCallback = onSavePreview;
    this.onCompleteCallback = onComplete;
  }

  connect() {
    this.ws = new ws.WebSocket(this.url);

    this.ws.on('open', () => {
      console.log('WebSocket connection established.');
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'status',
          data: { type: 'input', keys: ['progress', 'executed'] }
        }));
      }
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('WS message received:', JSON.stringify(msg, null, 2));
        if (msg.type === 'progress' && msg.data && msg.data.value && msg.data.max) {
          const progress = msg.data.value / msg.data.max;
          this.onProgressCallback?.(progress);
        } else if (msg.type === 'executing') {
          console.log('Executing message - Node:', msg.data?.node);
          console.log('Executing message - Output images:', msg.data?.output?.images);
          if (msg.data && msg.data.node?.class_type === 'PreviewImage' && msg.data.output?.images?.[0]?.subdata) {
            const base64 = msg.data.output.images[0].subdata;
            if (base64) {
              const dataUrl = `data:image/png;base64,${base64}`;
              this.onPreviewCallback?.(dataUrl);
            }
          }
        } else if (msg.type === 'executing' && (!msg.data || !msg.data.node)) {
          console.log('Completion signal: node is null/undefined');
          this.onCompleteCallback?.();
        }
      } catch (parseError) {
        console.error('Failed to parse WebSocket message:', parseError);
      }
    });

    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      this.handleReconnect();
    });

    this.ws.on('close', (event: ws.CloseEvent) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (!event.wasClean) {
        this.handleReconnect();
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(`Reconnecting WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      vscode.window.showWarningMessage('WebSocket connection failed after 3 attempts. Falling back to polling for real-time updates.');
    }
  }
}

const DEFAULT_WORKFLOW_TEMPLATE = `{"3":{"inputs":{"text":"negative prompt","clip":["4",0]},"class_type":"CLIPTextEncode","_meta":{"title":"CLIP Text Encode (Prompt)"}},"4":{"inputs":{"ckpt_name":"sd15.safetensors"},"class_type":"CheckpointLoaderSimple","_meta":{"title":"Load Checkpoint"}},"5":{"inputs":{"width":512,"height":512,"batch_size":1},"class_type":"EmptyLatentImage","_meta":{"title":"Empty Latent Image"}},"6":{"inputs":{"text":"a beautiful landscape","clip":["4",0]},"class_type":"CLIPTextEncode","_meta":{"title":"CLIP Text Encode (Prompt)"}},"7":{"inputs":{"seed":123456789,"steps":20,"cfg":8,"sampler_name":"euler","scheduler":"normal","denoise":1,"model":["4",0],"positive":["6",0],"negative":["3",0],"latent_image":["5",0]},"class_type":"KSampler","_meta":{"title":"KSampler"}},"8":{"inputs":{"samples":["7",0],"vae":["4",2]},"class_type":"VAEDecode","_meta":{"title":"VAE Decode"}},"9":{"inputs":{"filename_prefix":"ComfyUI","images":["8",0]},"class_type":"SaveImage","_meta":{"title":"Save Image"}},"links":[["4",0,"6",1],["4",0,"3",1],["5",0,"7",3],["6",0,"7",1],["3",0,"7",2],["4",0,"7",0],["7",0,"8",0],["4",2,"8",1],["8",0,"9",0]],"version":0.4}`;

/**
 * Fetches an image from the ComfyUI server with retry logic for transient errors.
 * @param serverUrl - The ComfyUI server URL.
 * @param filename - The image filename.
 * @param subfolder - The subfolder path.
 * @param type - The type ('input' or 'output').
 * @param maxRetries - Maximum number of retries.
 * @returns The response if successful, or throws on failure.
 */
async function fetchImageWithRetry(
  serverUrl: string,
  filename: string,
  subfolder: string,
  type: string,
  maxRetries: number = 2
): Promise<Response> {
  const imageUrl = `${serverUrl}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
  let retryCount = 0;
  let success = false;
  let viewResponse: Response | undefined;

  while (!success && retryCount <= maxRetries) {
    viewResponse = await fetch(imageUrl);
    if (viewResponse.ok) {
      success = true;
    } else if ((viewResponse.status === 404 || viewResponse.status === 500) && retryCount < maxRetries) {
      retryCount++;
      console.log(`Retry ${retryCount}/${maxRetries} due to status ${viewResponse.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.warn(`Failed to fetch image: ${viewResponse.status} ${viewResponse.statusText}, URL: ${imageUrl}`);
      break;
    }
  }

  if (!success || !viewResponse) {
    throw new Error(`Failed to fetch image after ${maxRetries + 1} attempts`);
  }

  return viewResponse;
}

/**
 * Fetches history from the ComfyUI server with retry logic for transient errors.
 * @param serverUrl - The ComfyUI server URL.
 * @param promptId - The prompt ID.
 * @param maxRetries - Maximum number of retries.
 * @returns The history data if successful, or throws on failure.
 */
async function fetchHistoryWithRetry(
  serverUrl: string,
  promptId: string,
  maxRetries: number = 3
): Promise<Record<string, any>> {
  const historyUrl = `${serverUrl}/history/${promptId}`;
  let retryCount = 0;
  let success = false;
  let historyResponse: Response | undefined;
  let historyData: Record<string, any> | undefined;

  while (!success && retryCount <= maxRetries) {
    historyResponse = await fetch(historyUrl);
    if (historyResponse.ok) {
      historyData = await historyResponse.json();
      success = true;
    } else if ((historyResponse.status === 404 || historyResponse.status === 500) && retryCount < maxRetries) {
      retryCount++;
      console.log(`Retry ${retryCount}/${maxRetries} for history due to status ${historyResponse.status}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      console.warn(`Failed to fetch history: ${historyResponse?.status} ${historyResponse?.statusText}, URL: ${historyUrl}`);
      break;
    }
  }

  if (!success || !historyData) {
    throw new Error(`Failed to fetch history after ${maxRetries + 1} attempts`);
  }

  return historyData;
}

/**
 * Processes the outputs from history to save images via HTTP, skipping PreviewImage if already handled by WS.
 * @param outputs - The outputs object from history.
 * @param workflow - The workflow object.
 * @param workspaceFolder - The VSCode workspace folder.
 * @param serverUrl - The ComfyUI server URL.
 * @param timestamp - Timestamp for filename uniqueness.
 * @param savedFilenames - Array to collect saved filenames.
 * @returns Array of saved full paths.
 */
async function processOutputs(
  outputs: Record<string, any>,
  workflow: any,
  workspaceFolder: vscode.WorkspaceFolder,
  serverUrl: string,
  timestamp: number,
  savedFilenames: string[]
): Promise<void> {
  const subfolder = '';
  for (const [outputNodeId, outputObj] of Object.entries(outputs)) {
    console.log(`Processing output node ${outputNodeId}:`, JSON.stringify(outputObj, null, 2));
    if (typeof outputObj !== 'object' || outputObj === null || !('images' in outputObj) || !Array.isArray(outputObj.images) || outputObj.images.length === 0) {
      console.log(`Skipping node ${outputNodeId}: no valid images`);
      continue;
    }

    const nodeId = parseInt(outputNodeId);
    const node = workflow[nodeId];
    if (!node || typeof node !== 'object' || node === null || !('class_type' in node)) {
      console.log(`Skipping node ${outputNodeId}: invalid node`);
      continue;
    }

    console.log(`Node ${outputNodeId} class_type: ${node.class_type}, images length: ${outputObj.images.length}`);

    if (!['SaveImage', 'PreviewImage'].includes(node.class_type)) {
      console.log(`Skipping non-matching node ${outputNodeId}: ${node.class_type}`);
      continue;
    }

    const type = node.class_type === 'SaveImage' ? 'output' : 'temp';
    const prefix = node.class_type === 'SaveImage' ? 'comfyui_saved_' : 'comfyui_preview_generated_';
    console.log(`Processing ${node.class_type} node ${outputNodeId} with type=${type}, prefix=${prefix}`);
    for (let i = 0; i < outputObj.images.length; i++) {
      const image = outputObj.images[i];
      if (typeof image !== 'object' || image === null || !('filename' in image) || typeof image.filename !== 'string') {
        continue;
      }

      const filename = image.filename;
      const imageUrl = `${serverUrl}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
      console.log(`Fetching image URL for ${node.class_type} node ${outputNodeId}: ${imageUrl}`);
      try {
        const viewResponse = await fetchImageWithRetry(serverUrl, filename, subfolder, type);
        const imageBuffer = await viewResponse.arrayBuffer();

        const imageFilename = `${prefix}${timestamp}_${nodeId}_${i}.png`;
        const fullPath = Uri.joinPath(workspaceFolder.uri, imageFilename);
        await vscode.workspace.fs.writeFile(fullPath, new Uint8Array(imageBuffer));
        console.log(`Successfully saved ${imageFilename} for ${node.class_type} to ${fullPath.fsPath}`);
        savedFilenames.push(fullPath.fsPath);
      } catch (error) {
        console.error(`Failed to process image ${i} for ${node.class_type} node ${nodeId}:`, error);
      }
    }
  }
}

/**
 * Generates an image using ComfyUI by submitting a workflow prompt and polling for completion.
 * Supports WebSocket for real-time previews and progress, HTTP for saving final images.
 * @param prompt - The text prompt for image generation.
 * @param config - VSCode configuration for ComfyUI settings.
 * @param onPreviewCallback - Optional callback for preview updates (via WS).
 * @param onProgressCallback - Optional callback for progress updates (via WS).
 * @returns Array of saved image file paths.
 * @throws Error on validation, submission, or processing failures.
 */
export async function generateImage(
  prompt: string,
  config: vscode.WorkspaceConfiguration,
  onPreviewCallback?: (dataUrl: string) => void,
  onProgressCallback?: (progress: number) => void
): Promise<string[]> {
  const savedFilenames: string[] = [];

  try {
    // Extract settings from config
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:8188');
    const apiKey = config.get<string>('apiKey');
    const workflowTemplateStr = config.get<string>('workflowTemplate', DEFAULT_WORKFLOW_TEMPLATE);
    const promptNodeId = config.get<string>('promptNodeId', '6');
    const promptInputKey = config.get<string>('promptInputKey', 'text');

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open.');
    }
    const workspaceDir = workspaceFolder.uri.fsPath;

    // Validate server URL
    if (!serverUrl || !serverUrl.startsWith('http')) {
      throw new Error('Invalid server URL. Must be a valid HTTP URL.');
    }

    // Load and validate workflow template
    let template: any;
    try {
      template = JSON.parse(workflowTemplateStr);
      if (!template || typeof template !== 'object') {
        throw new Error('Invalid workflow template structure.');
      }
    } catch (parseError) {
      console.warn('Failed to parse workflow template, using default:', parseError);
      template = JSON.parse(DEFAULT_WORKFLOW_TEMPLATE);
    }

    // Validate at least one SaveImage or PreviewImage node
    let hasValidNode = null;
    for (const [nodeId, node] of Object.entries(template)) {
      if (typeof node === 'object' && node !== null && 'class_type' in node && (node.class_type === 'SaveImage' || node.class_type === 'PreviewImage')) {
        hasValidNode = node.class_type;
        break;
      }
    }
    if (!hasValidNode) {
      throw new Error('No SaveImage or PreviewImage node found in workflow template.');
    }

    // Deep copy template
    const workflow = structuredClone(template);

    // Insert prompt
    const targetNode = workflow[promptNodeId];
    if (targetNode && targetNode.inputs && typeof targetNode.inputs[promptInputKey] === 'string') {
      targetNode.inputs[promptInputKey] = prompt;
    } else {
      // Fallback to default insertion (node 6, text)
      if (workflow['6'] && workflow['6'].inputs && typeof workflow['6'].inputs.text === 'string') {
        workflow['6'].inputs.text = prompt;
      } else {
        throw new Error('Could not insert prompt into workflow template.');
      }
    }

    // Prepare payload
    console.log('Workflow before submission:', JSON.stringify(workflow, null, 2));
    const payload: any = {
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

    // Setup WebSocket for previews and progress if callbacks provided
    console.log('hasValidNode',hasValidNode)
    if (hasValidNode === "PreviewImage") {
      console.log('serverUrl',serverUrl)
      const wsManager = new WebSocketManager(
        serverUrl,
        promptId,
        onPreviewCallback,
        onProgressCallback,
        workspaceDir
      );
      wsManager.connect();
    }

    // Poll /history/{promptId} every 2s, up to 5min
    const maxAttempts = 150;
    let attempts = 0;
    let historyData: Record<string, any> | null = null;

    while (attempts < maxAttempts) {
      const historyResponse = await fetch(`${serverUrl}/history/${promptId}`);
      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch history: ${historyResponse.statusText}`);
      }

      historyData = await historyResponse.json();
      console.log('History response for promptId', promptId, ':', JSON.stringify(historyData, null, 2));
      const entry = historyData?.[promptId];

      if (entry && entry.outputs) {
        break;
      } else if (!entry) {
        // In progress
      } else {
        throw new Error('Prompt execution failed on server (entry without outputs).');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (!historyData || !historyData[promptId]) {
      throw new Error('Timeout: Prompt did not complete within 5 minutes.');
    }

    const outputs = historyData[promptId].outputs as Record<string, any>;
    if (!outputs) {
      throw new Error('No outputs in history.');
    }

    console.log('Processing outputs from history');

    const timestamp = Date.now();
    await processOutputs(outputs, workflow, workspaceFolder, serverUrl, timestamp, savedFilenames);

    if (savedFilenames.length > 0) {
      console.log('Final saved filenames:', savedFilenames);
      vscode.window.showInformationMessage(`Generated ${savedFilenames.length} image(s).`);
      return savedFilenames;
    } else {
      console.error('No images saved.');
      throw new Error('No images generated or saved. Check workflow, server outputs, and accessibility.');
    }
  } catch (error) {
    console.error('Error in generateImage:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unexpected error: ${error}`);
    }
  }
}
export async function previewImage(
  prompt: string,
  config: vscode.WorkspaceConfiguration
): Promise<string> {
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:8188');
  const apiKey = config.get<string>('apiKey');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open.');
  }
  const workspaceDir = workspaceFolder.uri.fsPath;
  if (!serverUrl || !serverUrl.startsWith('http')) {
    throw new Error('Invalid server URL. Must be a valid HTTP URL.');
  }
  let template: any;
  try {
    template = JSON.parse(DEFAULT_WORKFLOW_TEMPLATE);
  } catch (parseError) {
    console.warn('Failed to parse workflow template, using default:', parseError);
    template = JSON.parse(DEFAULT_WORKFLOW_TEMPLATE);
  }
  // Modify for PreviewImage only
  delete template["9"];
  template.links = template.links.filter((link: [string, number, string, number]) => link[2] !== "9");
  template["9"] = {
    inputs: {
      images: ["8", 0]
    },
    class_type: "PreviewImage",
    _meta: {
      title: "Preview Image"
    }
  };
  template.links.push(["8", 0, "9", 0]);
  // Insert prompt
  const promptNodeId = config.get<string>('promptNodeId', '6');
  const promptInputKey = config.get<string>('promptInputKey', 'text');
  const targetNode = template[promptNodeId];
  if (targetNode && targetNode.inputs && typeof targetNode.inputs[promptInputKey] === 'string') {
    targetNode.inputs[promptInputKey] = prompt;
  } else {
    if (template['6'] && template['6'].inputs && typeof template['6'].inputs.text === 'string') {
      template['6'].inputs.text = prompt;
    } else {
      throw new Error('Could not insert prompt into workflow template.');
    }
  }
  const payload: any = {
    prompt: template,
    client_id: 'vscode-extension'
  };
  if (apiKey) {
    payload.extra_data = { api_key_comfy_org: apiKey };
  }
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
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeoutId = setTimeout(async () => {
      if (resolved) return;
      resolved = true;
      try {
        console.log('WS timeout for preview, falling back to history polling');
        let historyData: Record<string, any> | null = null;
        let pollAttempts = 0;
        const maxPollAttempts = 30;
        while (pollAttempts < maxPollAttempts) {
          try {
            historyData = await fetchHistoryWithRetry(serverUrl, promptId);
            const entry = historyData[promptId];
            if (entry && entry.outputs) {
              break;
            }
          } catch (error) {
            console.error('Error in fallback history fetch:', error);
          }
          if (pollAttempts < maxPollAttempts - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
          pollAttempts++;
        }
        if (!historyData || !historyData[promptId] || !historyData[promptId].outputs) {
          reject(new Error('Fallback polling failed: No outputs found in history.'));
          return;
        }
        const outputs = historyData[promptId].outputs as Record<string, any>;
        let found = false;
        for (const [nodeIdStr, node] of Object.entries(template)) {
          if (typeof node === 'object' && node !== null && 'class_type' in node && node.class_type === 'PreviewImage') {
            const outputNode = outputs[nodeIdStr];
            if (outputNode && outputNode.images && outputNode.images.length > 0) {
              const image = outputNode.images[0];
              if (image.filename) {
                const subfolder = '';
                const type_ = 'temp';
                const viewResponse = await fetchImageWithRetry(serverUrl, image.filename, subfolder, type_);
                const imageBuffer = await viewResponse.arrayBuffer();
                const uint8Array = new Uint8Array(imageBuffer);
                const base64Str = Buffer.from(uint8Array).toString('base64');
                const dataUrl = `data:image/png;base64,${base64Str}`;
                console.log('Fallback preview dataUrl generated from history');
                resolve(dataUrl);
                found = true;
                break;
              }
            }
          }
        }
        if (!found) {
          reject(new Error('Fallback failed: No PreviewImage output found in history.'));
        }
      } catch (error) {
        console.error('Fallback error:', error);
        reject(error);
      }
    }, 300000);
    const onPreview = (dataUrl: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolve(dataUrl);
    };
    const wsManager = new WebSocketManager(
      serverUrl,
      promptId,
      onPreview,
      undefined,
      workspaceDir,
      undefined
    );
    wsManager.connect();
  });
}

export async function saveImage(
  prompt: string,
  config: vscode.WorkspaceConfiguration
): Promise<string> {
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:8188');
  const apiKey = config.get<string>('apiKey');
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder open.');
  }
  if (!serverUrl || !serverUrl.startsWith('http')) {
    throw new Error('Invalid server URL. Must be a valid HTTP URL.');
  }
  let template: any;
  try {
    template = JSON.parse(DEFAULT_WORKFLOW_TEMPLATE);
  } catch (parseError) {
    throw new Error('Invalid workflow template structure.');
  }
  // Insert prompt
  const promptNodeId = config.get<string>('promptNodeId', '6');
  const promptInputKey = config.get<string>('promptInputKey', 'text');
  const targetNode = template[promptNodeId];
  if (targetNode && targetNode.inputs && typeof targetNode.inputs[promptInputKey] === 'string') {
    targetNode.inputs[promptInputKey] = prompt;
  } else {
    if (template['6'] && template['6'].inputs && typeof template['6'].inputs.text === 'string') {
      template['6'].inputs.text = prompt;
    } else {
      throw new Error('Could not insert prompt into workflow template.');
    }
  }
  const payload: any = {
    prompt: template,
    client_id: 'vscode-extension'
  };
  if (apiKey) {
    payload.extra_data = { api_key_comfy_org: apiKey };
  }
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
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: SaveImage did not complete within 5 minutes.'));
    }, 300000);

    const onComplete = async () => {
      clearTimeout(timeout);
      let historyData: Record<string, any> | null = null;
      let pollAttempts = 0;
      const maxPollAttempts = 30; // Additional 1 min polling if needed

      while (pollAttempts < maxPollAttempts) {
        try {
          historyData = await fetchHistoryWithRetry(serverUrl, promptId);
          const entry = historyData[promptId];
          if (entry && entry.outputs) {
            break;
          }
        } catch (error) {
          console.error('Error fetching history in post-completion poll:', error);
        }

        if (pollAttempts < maxPollAttempts - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
        pollAttempts++;
      }

      if (!historyData || !historyData[promptId] || !historyData[promptId].outputs) {
        reject(new Error('No outputs found in history after completion signal.'));
        return;
      }

      const outputs = historyData[promptId].outputs as Record<string, any>;
      if (!outputs) {
        reject(new Error('No outputs in history.'));
        return;
      }

      const timestamp = Date.now();
      const savedFilenames: string[] = [];
      try {
        await processOutputs(outputs, template, workspaceFolder, serverUrl, timestamp, savedFilenames);
        if (savedFilenames.length > 0) {
          resolve(savedFilenames[0]);
        } else {
          reject(new Error('No images generated or saved.'));
        }
      } catch (error) {
        reject(error);
      }
    };

    const wsManager = new WebSocketManager(
      serverUrl,
      promptId,
      undefined,
      undefined,
      undefined,
      undefined,
      onComplete
    );
    wsManager.connect();
  });
}