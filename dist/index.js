"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const uuid_1 = require("uuid");
const generative_ai_1 = require("@google/generative-ai");
const server_1 = require("@google/generative-ai/server");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = 3000;
const fileManager = new server_1.GoogleAIFileManager(process.env.GEMINI_API_KEY);
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(body_parser_1.default.json({ limit: '150mb' }));
app.use(body_parser_1.default.urlencoded({ limit: '150mb', extended: true }));
function isBase64(str) {
    try {
        return Buffer.from(str, 'base64').toString('base64') === str;
    }
    catch (err) {
        return false;
    }
}
app.post('/upload', async (req, res) => {
    const { image, customer_code, measure_datetime, measure_type } = req.body;
    if (!image || !customer_code || !measure_datetime || !measure_type) {
        const errorResponse = {
            error_code: 'INVALID_DATA',
            error_description: 'Missing required fields',
        };
        return res.status(400).json(errorResponse);
    }
    if (!isBase64(image)) {
        const errorResponse = {
            error_code: 'INVALID_DATA',
            error_description: 'Invalid base64 image',
        };
        return res.status(400).json(errorResponse);
    }
    const reportExists = false;
    if (reportExists) {
        const errorResponse = {
            error_code: 'DOUBLE_REPORT',
            error_description: 'Leitura do mês já realizada',
        };
        return res.status(409).json(errorResponse);
    }
    try {
        const buffer = Buffer.from(image, 'base64');
        const tempFilePath = path_1.default.join(__dirname, `temp_${(0, uuid_1.v4)()}.jpg`);
        fs_1.default.writeFileSync(tempFilePath, buffer);
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
            mimeType: "image/jpeg",
            displayName: "Uploaded Image",
        });
        fs_1.default.unlinkSync(tempFilePath);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResponse.file.mimeType,
                    fileUri: uploadResponse.file.uri,
                },
            },
            { text: "Describe the image content and how it might relate to the provided customer code." },
        ]);
        const measureValue = 1234;
        const response = {
            image_url: uploadResponse.file.uri,
            measure_value: measureValue,
            measure_uuid: (0, uuid_1.v4)(),
        };
        return res.status(200).json(response);
    }
    catch (error) {
        console.error("Error during AI processing:", error);
        const errorResponse = {
            error_code: 'AI_PROCESSING_ERROR',
            error_description: 'An error occurred while processing the image with Google Generative AI.',
        };
        return res.status(500).json(errorResponse);
    }
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
