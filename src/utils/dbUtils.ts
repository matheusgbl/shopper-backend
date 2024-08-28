import pool from '../db/pool';

import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function measureDatetimeExists(measureDatetime: string, measureType: 'WATER' | 'GAS'): Promise<boolean> {
  try {
    const query = 'SELECT COUNT(*) FROM measures WHERE measure_datetime = $1 AND measure_type = $2';
    const result = await pool.query(query, [measureDatetime, measureType]);
    return parseInt(result.rows[0].count, 10) > 0;
  } catch (error) {
    console.error('Error querying the database:', error);
    throw new Error('Database query failed');
  }
}

export async function createMeasureOnDatabase(
  tempFilePath: string,
  uploadResponse: any,
  customer_code: string,
  measure_datetime: string,
  measure_type: 'WATER' | 'GAS',
  result: any
): Promise<void> {
  await pool.query(
    `WITH file_insert AS (
       INSERT INTO files (file_name, file_uri, mime_type)
       VALUES ($1, $2, $3)
       RETURNING id
     )
     INSERT INTO measures (customer_code, measure_datetime, measure_type, image_url, measure_value, measure_uuid)
     VALUES ($4, $5, $6, $2, $7, $8)`,
    [
      path.basename(tempFilePath),
      uploadResponse.file.uri,
      uploadResponse.file.mimeType,
      customer_code,
      measure_datetime,
      measure_type,
      parseInt(result.response.text(), 10),
      uuidv4()
    ]
  );
}
