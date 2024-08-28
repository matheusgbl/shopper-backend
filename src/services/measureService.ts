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
    return "Get only the red numbers that it's displayed in the hydrometer, and return only the red numbers as an integer"
  } else {
    return "Get only the red numbers that it's displayed in the gas meter, and return only the red numbers as an integer"
  }
}

export function isValidDatetimeFormat(measureDatetime: string): boolean {
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?$/;

  return datetimeRegex.test(measureDatetime);
}

export async function getMeasureStatus(measure_uuid: string): Promise<{ exists: boolean, confirmed: boolean }> {
  try {
    const query = 'SELECT confirmed_value IS NOT NULL AS confirmed FROM measures WHERE measure_uuid = $1';
    const result = await pool.query(query, [measure_uuid]);
    if (result.rows.length > 0) {
      return { exists: true, confirmed: result.rows[0].confirmed };
    } else {
      return { exists: false, confirmed: false };
    }
  } catch (error) {
    console.error('Error querying the database:', error);
    throw new Error('Database query failed');
  }
}

export async function updateMeasure(confirmed_value: number, measure_uuid: string) {
  await pool.query('UPDATE measures SET confirmed_value = $1, confirmed_at = NOW() WHERE measure_uuid = $2', [confirmed_value, measure_uuid]);
}
