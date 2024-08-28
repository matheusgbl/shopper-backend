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
