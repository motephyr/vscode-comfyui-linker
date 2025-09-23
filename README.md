# vscode-comfyui-linker

## 專案概述

vscode-comfyui-linker 是一個 Visual Studio Code (VSCode) 擴充功能，專為開發者和創作者設計。它允許使用者直接從 VSCode 介面連接到 ComfyUI 伺服器，使用可設定的工作流程從文字提示（prompt）生成圖像。ComfyUI 是一個基於 Stable Diffusion 的強大圖像生成工具，此擴充功能簡化了整合流程，讓您無需切換應用程式，即可產生 AI 輔助的視覺內容。無論是快速原型設計、內容創作或程式碼相關的視覺化，此工具都能提升您的生產力。

## 功能特色

- **伺服器連線設定**：輕鬆配置 ComfyUI 伺服器的 URL 和 API 金鑰，支持本地或遠端伺服器。
- **自訂工作流程模板**：匯入 ComfyUI 的 JSON 工作流程模板，並動態插入使用者提供的提示文字。
- **命令驅動介面**：透過 VSCode 命令面板（Ctrl+Shift+P）執行「ComfyUI: Generate Image from Prompt」，輸入提示後自動生成圖像。
- **動態提示插入**：自動將提示文字注入指定節點，支持簡單的字串替換機制。
- **錯誤處理與後備**：內建驗證機制，若自訂模板無效，則自動回退到預設工作流程；顯示清晰的錯誤訊息。
- **自動圖像儲存**：生成的圖像會儲存到專案目錄的 `generated/` 資料夾，便於管理與追蹤。

## 安裝

1. 從發布頁面或專案目錄下載最新的 `.vsix` 檔案，例如 `vscode-comfyui-linker-0.0.2.vsix`。
2. 開啟 VSCode，按 Ctrl+Shift+P 召喚命令面板，輸入並選擇「Extensions: Install from VSIX...」。
3. 瀏覽並選擇下載的 `.vsix` 檔案，確認安裝。
4. 安裝完成後，按 Ctrl+Shift+P 輸入「Developer: Reload Window」重載 VSCode，以啟用擴充功能。

安裝後，您可在擴充功能檢視（Ctrl+Shift+X）中看到「vscode-comfyui-linker」已啟用。

## 設定

所有設定均透過 VSCode 的設定系統管理。您可以按 Ctrl+, 開啟圖形化設定介面，搜尋「comfyui」；或直接編輯 `settings.json` 檔案（在使用者設定或工作區設定中）。

### 主要設定項目

- **comfyui.serverUrl** (字串)：ComfyUI 伺服器的基底 URL。預設為 `"http://127.0.0.1:8188"`。
  示例：
  ```json
  "comfyui.serverUrl": "http://localhost:8188"
  ```

- **comfyui.apiKey** (字串)：用於認證的 API 金鑰，若伺服器未啟用認證則留空。預設為 `""`。
  示例：
  ```json
  "comfyui.apiKey": "your-secret-api-key"
  ```

- **comfyui.workflowTemplate** (字串)：自訂工作流程的 JSON 模板，以字串形式儲存。從 ComfyUI UI 匯出工作流程（點擊「Menu」>「Export API Format」），複製整個 JSON 內容貼入此設定。
  示例（簡化版）：
  ```json
  "comfyui.workflowTemplate": "{\"1\":{\"inputs\":{\"ckpt_name\":\"sd_xl_base_1.0.safetensors\"},\"class_type\":\"CheckpointLoaderSimple\",\"_meta\":{\"title\":\"Load Checkpoint\"}},\"4\":{\"inputs\":{\"text\":\"{{prompt}}\",\"clip\":\"1\"},\"class_type\":\"CLIPTextEncode\",\"_meta\":{\"title\":\"Positive Prompt\"}},\"9\":{\"inputs\":{\"images\":[\"7\"]},\"class_type\":\"SaveImage\",\"_meta\":{\"title\":\"Save Image\"}}}"
  ```
  注意：模板中提示文字使用 `{{prompt}}` 佔位符，將被替換為使用者輸入。

- **comfyui.promptNodeId** (字串)：提示節點的 ID，預設為 `"4"`。對應模板中接收提示的節點。
  示例：
  ```json
  "comfyui.promptNodeId": "4"
  ```

- **comfyui.promptInputKey** (字串)：提示輸入的鍵值，預設為 `"text"`。用於指定節點輸入的欄位。
  示例：
  ```json
  "comfyui.promptInputKey": "text"
  ```

匯出工作流程提示：啟動 ComfyUI UI，載入或建立工作流程，確保包含提示輸入（如 CLIPTextEncode）和 SaveImage 節點，然後匯出 JSON。將 `{{prompt}}` 置於提示輸入處。

## 使用方法

1. 確保 ComfyUI 伺服器已啟動（在終端機執行 `python main.py --listen 0.0.0.0 --port 8188` 或類似命令）。
2. 在 VSCode 中，按 Ctrl+Shift+P 開啟命令面板，輸入並選擇「ComfyUI: Generate Image from Prompt」。
3. 在彈出輸入框中輸入您的文字提示，例如「一隻可愛的貓咪在花園中玩耍」。
4. 按 Enter 確認。擴充功能將連接到伺服器，執行工作流程，並等待生成完成（可能需數秒至數分鐘，視模型而定）。
5. 生成成功後，圖像將自動儲存至專案根目錄的 `generated/` 資料夾（若資料夾不存在，將自動建立）。在 VSCode 檔案總管中檢查新檔案，例如 `generated/image_001.png`。
6. 若發生錯誤，檢查 VSCode 通知或輸出面板（View > Output > ComfyUI Linker）。

## 測試指示

### 基本測試（使用預設設定）

1. 安裝擴充功能並重載 VSCode。
2. 啟動本地 ComfyUI 伺服器（確保有基本模型如 SD 1.5）。
3. 執行「ComfyUI: Generate Image from Prompt」，輸入「a red apple」。
4. 驗證圖像生成並儲存至 `generated/`，無錯誤訊息。

### 自訂測試（設定工作流程模板）

1. 在 ComfyUI UI 中建立一個包含提示輸入和 SaveImage 的簡單工作流程，匯出 JSON。
2. 在 VSCode 設定中貼上 workflowTemplate，調整 promptNodeId（如 "4"）和 promptInputKey（如 "text"）。
3. 執行命令，輸入自訂提示如「未來城市的夜景」。
4. 確認圖像符合自訂工作流程（例如特定模型或解析度），並檢查輸出面板的請求細節。

### 錯誤測試（無效 JSON 模板）

1. 在 workflowTemplate 中輸入無效 JSON，例如缺少逗號或大括號：`"{\"1\":{invalid}}"`。
2. 執行命令，輸入提示。
3. 驗證擴充功能顯示錯誤（如「Invalid workflow template JSON」）並自動使用預設後備模板生成圖像。

### 後備測試（無自訂模板）

1. 清空或移除 workflowTemplate 設定。
2. 執行命令，使用簡單提示。
3. 確認使用內建預設模板（基本提示到圖像）成功生成，無崩潰。

測試時，請監控 ComfyUI 伺服器日誌以確認請求接收。

## 疑難排解

- **連線失敗（伺服器未運行）**：確認 ComfyUI 伺服器在指定 URL（如 http://127.0.0.1:8188）運行。檢查終端機輸出、防火牆設定或端口衝突。嘗試在瀏覽器開啟該 URL 驗證。
- **模型遺失錯誤**：ComfyUI 回報「No such model」。確保 `models/checkpoints/` 資料夾中有必要的 `.safetensors` 或 `.ckpt` 檔案。重新載入模型或檢查工作流程中的 ckpt_name。
- **無效模板錯誤**：JSON 解析失敗。使用線上 JSON 驗證器檢查模板格式，確保佔位符 `{{prompt}}` 正確置於提示輸入。重新從 ComfyUI 匯出。
- **API 金鑰無效**：伺服器拒絕請求 401。確認 apiKey 正確，或停用伺服器認證。
- **圖像未生成或儲存失敗**：檢查 SaveImage 節點 ID 是否為 "9"（預設）。權限問題：確保專案目錄可寫入。網路延遲：增加伺服器資源或使用本地伺服器。
- **VSCode 無回應**：檢查輸出面板錯誤。重啟 VSCode 或重新安裝擴充功能。

若問題持續，檢查 ComfyUI 版本相容性（建議最新版），或在 GitHub 問題頁回報。

## 限制

- **節點假設**：工作流程假設 SaveImage 節點 ID 為 "9"，若不同需修改原始碼 [src/comfyui.ts](src/comfyui.ts)。
- **提示插入簡易**：僅支援單一字串替換 `{{prompt}}`，不處理多提示、權重或進階參數（如 CFG scale）。
- **無 UI 編輯器**：無法在 VSCode 中編輯工作流程；必須依賴 ComfyUI 的圖形介面匯出。
- **單一生成**：不支持批次提示或即時預覽；每次命令僅生成一張圖像。
- **依賴外部伺服器**：性能受 ComfyUI 硬體和網路影響；不包含模型下載或伺服器管理功能。
- **語言支援**：提示支援英文最佳；中文提示可能需特定模型如 SDXL 中文版。

未來版本可擴充這些功能。

## 授權資訊

此專案採用 MIT 授權，允許自由使用、修改和分發。完整授權條款請見 [LICENSE](LICENSE) 檔案。

如有問題或貢獻，請參閱原始碼或開啟 GitHub 問題。