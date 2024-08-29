import { isValidDatetimeFormat, isBase64, measureDatetimeExists } from '../services/measureService';
import pool from '../db/pool';

describe('isValidDatetimeFormat', () => {
  it('should return true for valid datetime format', () => {
    const validDatetime = '2024-08-27T10:15:30Z';
    expect(isValidDatetimeFormat(validDatetime)).toBe(true);
  });

  it('should return false for invalid datetime format', () => {
    const invalidDatetime = '27-08-2024';
    expect(isValidDatetimeFormat(invalidDatetime)).toBe(false);
  });
});

describe('isBase64', () => {
  it('should return true for a valid base64 string', () => {
    const validBase64 = 'aGVsbG8gd29ybGQ=';
    expect(isBase64(validBase64)).toBe(true);
  });

  it('should return false for an invalid base64 string', () => {
    const invalidBase64 = 'hello world';
    expect(isBase64(invalidBase64)).toBe(false);
  });
});


jest.mock('../db/pool', () => ({
  query: jest.fn(),
}));

describe('measureDatetimeExists', () => {
  it('should return true if measure_datetime exists', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const result = await measureDatetimeExists('2024-08-27T10:15:30Z', 'WATER');
    expect(result).toBe(true);
  });

  it('should return false if measure_datetime does not exist', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const result = await measureDatetimeExists('2024-08-27T10:15:30Z', 'GAS');
    expect(result).toBe(false);
  });
});

