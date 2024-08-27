import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from 'fs';
import path from 'path';
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port: number = 3000;

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY as string);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

interface MeasureRequestBody {
  image: string;
  customer_code: string;
  measure_datetime: string;
  measure_type: 'WATER' | 'GAS';
}

interface MeasureResponse {
  image_url: string;
  measure_value: number;
  measure_uuid: string;
}

interface ErrorResponse {
  error_code: string;
  error_description: string;
}

function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch (err) {
    return false;
  }
}

app.post('/upload', async (req: Request, res: Response) => {
  const { image, customer_code, measure_datetime, measure_type } = req.body as MeasureRequestBody;

  if (!image || !customer_code || !measure_datetime || !measure_type) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Missing required fields',
    };
    return res.status(400).json(errorResponse);
  }

  if (!isBase64(image)) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Invalid base64 image',
    };
    return res.status(400).json(errorResponse);
  }

  const reportExists = false;

  if (reportExists) {
    const errorResponse: ErrorResponse = {
      error_code: 'DOUBLE_REPORT',
      error_description: 'Leitura do mês já realizada',
    };
    return res.status(409).json(errorResponse);
  }

  try {
    const buffer = Buffer.from(image, 'base64');
    const tempFilePath = path.join(__dirname, `temp_${uuidv4()}.jpg`);

    fs.writeFileSync(tempFilePath, buffer);

    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType: "image/jpeg",
      displayName: "Uploaded Image",
    });

    fs.unlinkSync(tempFilePath);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri,
        },
      },
      { text: "Get the number of battery life in integer and return just how many minutes, just the number" },
    ]);

    const response: MeasureResponse = {
      image_url: uploadResponse.file.uri,
      measure_value: parseInt(result.response.text(), 10),
      measure_uuid: uuidv4(),
    };
    

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error during AI processing:", error);
    const errorResponse: ErrorResponse = {
      error_code: 'AI_PROCESSING_ERROR',
      error_description: 'An error occurred while processing the image with Google Generative AI.',
    };
    return res.status(500).json(errorResponse);
  }
});

app.get("/", async (req: Request, res: Response) => {

  try {
    const listFilesResponse = await fileManager.listFiles();
    
    for (const file of listFilesResponse.files) {
      console.log(`name: ${file.name} | display name: ${file.displayName}`);
    }

    return res.status(200).json(listFilesResponse.files);
  } catch (error) {
    console.log(error);
  }
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
