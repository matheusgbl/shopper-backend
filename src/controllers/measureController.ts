import { Request, Response } from 'express';
import { isValidDatetimeFormat, isBase64, changeTextBasedOnMeasureType, getMeasureStatus, updateMeasure, measureDatetimeExists, createMeasureOnDatabase } from '../services/measureService';
import { ErrorResponse, MeasureResponse, ConfirmRequestBody, MeasureRequestBody } from '../interfaces/measureInterfaces';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY as string);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function uploadMeasure(req: Request, res: Response) {
  const { image, customer_code, measure_datetime, measure_type } = req.body as MeasureRequestBody;
  const id = uuidv4();
  
  if (!image || !customer_code || !measure_datetime || !measure_type) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Alguns dados estão faltando, verifique e tente novamente.',
    };
    return res.status(400).json(errorResponse);
  }

  if (!isValidDatetimeFormat(measure_datetime)) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Data informada não está em formato válido, utilize o formato datetime.',
    };
    return res.status(400).json(errorResponse);
  }

  if (!isBase64(image)) {
    const errorResponse: ErrorResponse = {
      error_code: 'INVALID_DATA',
      error_description: 'Imagem está com formato errado, utilize base64',
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
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    };

    fs.writeFileSync(tempFilePath, buffer);

    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType: "image/jpeg",
      displayName: "Uploaded Image",
    });

    fs.unlinkSync(tempFilePath);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const parts = [
      { text: changeTextBasedOnMeasureType(measure_type) },
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri,
        },
      }
    ];

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
    });
    
    const responseText = await result.response.text();
    const jsonResponse = JSON.parse(responseText);

    const measureString = jsonResponse.measure;

    const measureValue = parseInt(measureString, 10);

    const response: MeasureResponse = {
      image_url: uploadResponse.file.uri,
      measure_value: measureValue,
      measure_uuid: id,
    };

    createMeasureOnDatabase(
        path.basename(tempFilePath),             
        uploadResponse,                 
        customer_code,                            
        measure_datetime,                         
        measure_type,                            
        measureValue,
        id
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
}

export async function confirmMeasureController(req: Request, res: Response) {
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
}

export async function listMeasuresController(req: Request, res: Response) {
  const { customer_code } = req.params;
  const { measure_type } = req.query;

  if (measure_type && !['WATER', 'GAS'].includes((measure_type as string).toUpperCase())) {
    return res.status(400).json({
      error_code: 'INVALID_TYPE',
      error_description: 'Tipo de medição não permitida',
    });
  }

  try {
    const queryParams = [customer_code];
    let query = `
      SELECT 
        measure_uuid, 
        measure_datetime, 
        measure_type, 
        confirmed_at IS NOT NULL AS has_confirmed, 
        image_url 
      FROM 
        measures 
      WHERE 
        customer_code = $1
    `;

    if (measure_type) {
      query += ' AND measure_type = $2';
      queryParams.push((measure_type as string).toUpperCase());
    }

    const result = await pool.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error_code: 'MEASURES_NOT_FOUND',
        error_description: 'Nenhuma leitura encontrada',
      });
    }

    return res.status(200).json({
      customer_code,
      measures: result.rows.map((row) => ({
        measure_uuid: row.measure_uuid,
        measure_datetime: row.measure_datetime,
        measure_type: row.measure_type,
        has_confirmed: row.has_confirmed,
        image_url: row.image_url,
      })),
    });

  } catch (error) {
    console.error('Error querying the database:', error);
    return res.status(500).json({
      error_code: 'SERVER_ERROR',
      error_description: 'Erro no servidor ao buscar as leituras',
    });
  }
}
