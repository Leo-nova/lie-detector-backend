// 載入所需套件
require('dotenv').config(); // 讀取 .env 檔案
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors'); // 處理跨來源請求

// 初始化 Express 應用
const app = express();
app.use(express.json()); // 讓 Express 可以解析 JSON 格式的請求內容
app.use(cors()); // 啟用 CORS，允許您的前端 APP 存取

// 從環境變數讀取金鑰和通訊埠
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

// 建立一個 API 端點 '/analyze'
app.post('/analyze', async (req, res) => {
    // 檢查請求中是否包含文字
    const inputText = req.body.text;
    if (!inputText) {
        return res.status(400).json({ error: '請求中缺少需要分析的文字 (text)。' });
    }

    const prompt = `**最高指令：你所有的輸出，都必須、也只能使用繁體中文（台灣）。**

你是一個極度嚴謹、客觀且中立的事實查核助理。你的任務是分析使用者提供的文本，並遵循以下流程與鐵則：
1.  **核心原則**: 你的分析應保持一致性與客觀性。對於同一問題，即使多次詢問，也應基於可查證的事實，提供相似的結論。你的首要任務是查核事實，而非創造性寫作。
2.  **預先判斷**: 首先，評估文本是否為一個值得進行事實查核的嚴肅聲明。如果文本明顯是荒謬、諷刺、比喻或不合邏輯的（例如「天空是綠色的」、「狗狗是鳥類」），請直接將其狀態標記為 "邏輯不符"。
3.  **事實查核**: 如果文本是一個嚴肅的聲明，請找出其中包含的可查核事實。
4.  **狀態判斷**: 根據你查核的結果，為該聲明選擇一個最貼切的狀態標籤。標籤的定義如下：
    * **已證實**: 當聲明與可靠、公開的資訊完全相符。
    * **與事實不符**: 當聲明與可靠、公開的資訊完全矛盾。
    * **有爭議**: 當聲明存在多方觀點，且沒有壓倒性的證據支持任何一方。
    * **無法查證**: 當找不到可靠的公開資訊來驗證此聲明。
5.  **來源處理鐵則**:
    * **如果能找到真實、權威的網頁來源**，請在 source 欄位提供**完整的 URL**。
    * **如果找不到可靠的公開資訊**，請在 source 欄位中明確標示為「N/A」。
    * **絕對不允許杜撰或猜測網址**。如果來源不明確，寧可標示為「N/A」，也不要提供錯誤的連結。

請嚴格按照指定的JSON格式回傳，不要有任何額外的文字或解釋。

文本: "${inputText}"`;

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "findings": {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "claim": { "type": "STRING" },
                                "status": { "type": "STRING", "enum": ["已證實", "與事實不符", "有爭議", "無法查證", "邏輯不符"] },
                                "explanation": { "type": "STRING" },
                                "source": { "type": "STRING" }
                            },
                            required: ["claim", "status", "explanation"]
                        }
                    }
                }
            }
        }
    };

    try {
        const apiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`Gemini API Error: ${apiResponse.status}`, errorText);
            return res.status(apiResponse.status).json({ error: `AI 伺服器錯誤: ${errorText}` });
        }

        const data = await apiResponse.json();

        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0].text) {
            console.error('來自 Gemini API 的回應結構無效:', data);
            return res.status(500).json({ error: 'AI 未能生成有效的分析結果。' });
        }
        
        const contentText = data.candidates[0].content.parts[0].text;
        const content = JSON.parse(contentText);
        res.json(content);

    } catch (error) {
        console.error('伺服器內部錯誤:', error);
        res.status(500).json({ error: '伺服器在處理請求時發生內部錯誤。' });
    }
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});
