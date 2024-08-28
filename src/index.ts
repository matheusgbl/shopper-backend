import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from 'fs';
import path from 'path';
import dotenv from "dotenv";

import { measureDatetimeExists, createMeasureOnDatabase, updateMeasure } from './utils/dbUtils';
import { changeTextBasedOnMeasureType, getMeasureStatus, isBase64, isValidDatetimeFormat } from './utils/measureUtils';
import { MeasureRequestBody, ErrorResponse, MeasureResponse, ConfirmRequestBody } from './interfaces/measureInterfaces';

dotenv.config();

const app = express();
const port: number = 3000;

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY as string);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.post('/upload', async (req: Request, res: Response) => {
  const { image, customer_code, measure_datetime, measure_type } = req.body as MeasureRequestBody;

  if (!image || !customer_code || !measure_datetime || !measure_type) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Missing required fields',
    };
    return res.status(400).json(errorResponse);
  }

  if (!isValidDatetimeFormat(measure_datetime)) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Invalid datetime value',
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

  const reportExists = await measureDatetimeExists(measure_datetime, measure_type);

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
      { text: changeTextBasedOnMeasureType(measure_type) },
    ]);

    const response: MeasureResponse = {
      image_url: uploadResponse.file.uri,
      measure_value: parseInt(result.response.text(), 10),
      measure_uuid: uuidv4(),
    };

    createMeasureOnDatabase(
        path.basename(tempFilePath),             
        uploadResponse,                 
        customer_code,                            
        measure_datetime,                         
        measure_type,                            
        result
    );

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

app.patch('/confirm', async (req: Request, res: Response) => {
  const { measure_uuid, confirmed_value } = req.body as ConfirmRequestBody;

  if (typeof measure_uuid !== 'string') {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'O id de medida não está correto, por favor verifique e tente novamente',
    };
    return res.status(400).json(errorResponse);
  }

  if (typeof confirmed_value !== 'number') {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'O campo de número de confirmação deve ser um número inteiro.',
    };
    return res.status(400).json(errorResponse);
  }

  try {
    const { exists, confirmed } = await getMeasureStatus(measure_uuid);

    if (!exists) {
      const errorResponse: ErrorResponse = {
        error_code: 'MEASURE_NOT_FOUND',
        error_description: 'Leitura do mês não encontrada',
      };
      return res.status(404).json(errorResponse);
    }

    if (confirmed) {
      const errorResponse: ErrorResponse = {
        error_code: 'CONFIRMATION_DUPLICATE',
        error_description: 'Leitura do mês já realizada',
      };
      return res.status(409).json(errorResponse);
    }

    updateMeasure(confirmed_value, measure_uuid);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing the request:', error);
    const errorResponse: ErrorResponse = {
      error_code: 'PROCESSING_ERROR',
      error_description: 'An error occurred while processing your request',
    };
    return res.status(500).json(errorResponse);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
