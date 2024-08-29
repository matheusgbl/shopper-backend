import path from "path";
import pool from "../db/pool";

export function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch (err) {
    return false;
  }
}

export function changeTextBasedOnMeasureType(measure: string) {
  if (measure === "WATER") {
    return "This is a picture of a hydrometer and you need to get the info of the volume, return only the painted red numbers the JSON return must be { 'measure': <value> }"
  } else {
    return "This is a picture of a gas meter and you need to get the info of consume of gas from this picture, return only the painted red numbers the JSON return must be { 'measure': <value> }"
  }
}

export function isValidDatetimeFormat(measureDatetime: string): boolean {
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?$/;

  return datetimeRegex.test(measureDatetime);
}

export async function getMeasureStatus(measure_uuid: string): Promise<{ exists: boolean, confirmed: boolean }> {
  try {
    const query = `
      SELECT confirmed_at IS NOT NULL AS confirmed 
      FROM measures 
      WHERE measure_uuid = $1
    `;
    const result = await pool.query(query, [measure_uuid]);

    if (result.rows.length > 0) {
      const confirmed = result.rows[0].confirmed;
      return { exists: true, confirmed: confirmed };
    } else {
      return { exists: false, confirmed: false };
    }
  } catch (error) {
    console.error('Error querying the database:', error);
    throw new Error('Database query failed');
  }
}


export async function updateMeasure(confirmed_value: number, measure_uuid: string) {
  try {
    const query = `
      UPDATE measures 
      SET measure_value = $1, confirmed_at = NOW() 
      WHERE measure_uuid = $2
    `;
    await pool.query(query, [confirmed_value, measure_uuid]);
  } catch (error) {
    console.error('Error updating the measure:', error);
    throw new Error('Database update failed');
  }
}

export async function createMeasureOnDatabase(
  tempFilePath: string,
  uploadResponse: any,
  customer_code: string,
  measure_datetime: string,
  measure_type: 'WATER' | 'GAS',
  measure_value: number,
  id: string
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
      measure_value,
      id
    ]
  );
}

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
