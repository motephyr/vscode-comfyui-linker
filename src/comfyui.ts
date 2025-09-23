import * as vscode from 'vscode';
import { Uri } from 'vscode';

const WORKFLOW_TEMPLATE = {} as const;

export async function generateImage(
  prompt: string,
  config: vscode.WorkspaceConfiguration
): Promise<string[]> {
  try {
    // Extract settings from config
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:8188');
    const apiKey = config.get<string>('apiKey');
    const workflowTemplateStr = config.get<string>('workflowTemplate', '');
    console.log('Retrieved workflowTemplate:', workflowTemplateStr);
    const promptNodeId = config.get<string>('promptNodeId', '6');
    const promptInputKey = config.get<string>('promptInputKey', 'text');

    // Validate server URL
    if (!serverUrl || !serverUrl.startsWith('http')) {
      throw new Error('Invalid server URL. Must be a valid HTTP URL.');
    }

    // Load and validate workflow template
    let template: any;
    try {
      if (workflowTemplateStr) {
        template = JSON.parse(workflowTemplateStr);
        console.log('Parsed template:', template);
        if (!template || typeof template !== 'object') {
          throw new Error('Invalid workflow template structure.');
        }
      } else {
        throw new Error('Empty workflow template.');
      }
    } catch (parseError) {
      console.log('Using default template due to parse error or empty');
      // Fallback to default
      template = structuredClone(WORKFLOW_TEMPLATE);
    }
    console.log('Using custom template');

    // Validate at least one SaveImage or PreviewImage node
    let hasValidNode = false;
    for (const [nodeId, node] of Object.entries(template)) {
      if (typeof node === 'object' && node !== null && 'class_type' in node && (node.class_type === 'SaveImage' || node.class_type === 'PreviewImage')) {
        hasValidNode = true;
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

    // Poll /history/{promptId} every 2s, up to 5min (300s)
    const maxAttempts = 150; // 300 / 2
    let attempts = 0;
    let historyData: any = null;

    while (attempts < maxAttempts) {
      const historyResponse = await fetch(`${serverUrl}/history/${promptId}`);
      if (!historyResponse.ok) {
        throw new Error(`Failed to fetch history: ${historyResponse.statusText}`);
      }

      historyData = await historyResponse.json();
      const entry = historyData[promptId];

      if (entry && entry.outputs) {
        // Completed: outputs present
        break;
      } else if (!entry) {
        // In progress: no entry yet
      } else {
        // Entry exists but no outputs: failed
        throw new Error('Prompt execution failed on server (entry without outputs).');
      }

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (!historyData || !historyData[promptId]) {
      throw new Error('Timeout: Prompt did not complete within 5 minutes.');
    }

    const outputs = historyData[promptId].outputs;
    if (!outputs) {
      throw new Error('No outputs in history.');
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open.');
    }

    const timestamp = Date.now();
    let imagePaths: string[] = [];

    // Iterate over outputs to find SaveImage or PreviewImage nodes
    for (const [outputNodeId, outputObj] of Object.entries(outputs)) {
      if (typeof outputObj !== 'object' || outputObj === null) continue;
      if (!('images' in outputObj) || !Array.isArray(outputObj.images) || outputObj.images.length === 0) continue;

      const nodeId = parseInt(outputNodeId);
      const node = workflow[nodeId];
      if (!node || typeof node !== 'object' || node === null || !('class_type' in node)) continue;
      if (node.class_type !== 'SaveImage' && node.class_type !== 'PreviewImage') continue;

      const subfolder = '';
      const type = node.class_type === 'SaveImage' || node.class_type === 'PreviewImage' ? 'output' : 'input';
      for (let i = 0; i < outputObj.images.length; i++) {
        const image = outputObj.images[i];
        console.log('image',image)
        if (typeof image !== 'object' || image === null || !('filename' in image) || typeof image.filename !== 'string') continue;

        const filename = image.filename;
        console.log('filename',filename)

        const viewResponse = await fetch(
          `${serverUrl}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`
        );

        if (!viewResponse.ok) {
          console.warn(`Failed to fetch image from node ${nodeId}, image ${i}: ${viewResponse.statusText}`);
          continue;
        }

        const imageBuffer = await viewResponse.arrayBuffer();

        const imageFilename = `comfyui_generated_${timestamp}_${nodeId}_${i}.png`;
        const fullPath = Uri.joinPath(workspaceFolder.uri, imageFilename);
        console.log(`Saving image to: ${fullPath.fsPath}`);

        await vscode.workspace.fs.writeFile(fullPath, new Uint8Array(imageBuffer));
        console.log(`Successfully saved ${imageFilename}`);
        imagePaths.push(fullPath.fsPath);
      }
    }

    if (imagePaths.length === 0) {
      throw new Error('No images generated from any node.');
    }

    return imagePaths;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unexpected error: ${error}`);
    }
  }
}