import request from 'supertest';
import express from 'express';
import { uploadMeasure, confirmMeasureController, listMeasuresController } from '../controllers/measureController';
import * as measureService from '../services/measureService';
import pool from '../config/database';

const app = express();
app.use(express.json());

app.post('/upload-measure', uploadMeasure);
app.post('/confirm-measure', confirmMeasureController);
app.get('/list-measures/:customer_code', listMeasuresController);

jest.mock('../services/measureService');
jest.mock('../config/database');

describe('Measure Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadMeasure', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/upload-measure')
        .send({ image: '', customer_code: '', measure_datetime: '', measure_type: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.error_code).toBe('INVALID_DATA');
    });

    it('should return 400 if datetime format is invalid', async () => {
      const response = await request(app)
        .post('/upload-measure')
        .send({ image: 'base64image', customer_code: '123', measure_datetime: 'invalid-date', measure_type: 'WATER' });
      
      expect(response.status).toBe(400);
      expect(response.body.error_code).toBe('INVALID_DATA');
    });
  });

  describe('confirmMeasureController', () => {
    it('should return 400 if measure_uuid is not a string', async () => {
      const response = await request(app)
        .post('/confirm-measure')
        .send({ measure_uuid: 123, confirmed_value: 456 });

      expect(response.status).toBe(400);
      expect(response.body.error_code).toBe('INVALID_DATA');
    });

    it('should return 400 if confirmed_value is not a number', async () => {
      const response = await request(app)
        .post('/confirm-measure')
        .send({ measure_uuid: 'uuid', confirmed_value: 'not-a-number' });

      expect(response.status).toBe(400);
      expect(response.body.error_code).toBe('INVALID_DATA');
    });

    it('should return 404 if the measure does not exist', async () => {
      (measureService.getMeasureStatus as jest.Mock).mockResolvedValue({ exists: false, confirmed: false });

      const response = await request(app)
        .post('/confirm-measure')
        .send({ measure_uuid: 'uuid', confirmed_value: 456 });

      expect(response.status).toBe(404);
      expect(response.body.error_code).toBe('MEASURE_NOT_FOUND');
    });

    it('should return 409 if the measure is already confirmed', async () => {
      (measureService.getMeasureStatus as jest.Mock).mockResolvedValue({ exists: true, confirmed: true });

      const response = await request(app)
        .post('/confirm-measure')
        .send({ measure_uuid: 'uuid', confirmed_value: 456 });

      expect(response.status).toBe(409);
      expect(response.body.error_code).toBe('CONFIRMATION_DUPLICATE');
    });

    it('should return 200 on successful confirmation', async () => {
      (measureService.getMeasureStatus as jest.Mock).mockResolvedValue({ exists: true, confirmed: false });
      (measureService.updateMeasure as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/confirm-measure')
        .send({ measure_uuid: 'uuid', confirmed_value: 456 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('listMeasuresController', () => {
    it('should return 400 if measure_type is invalid', async () => {
      const response = await request(app)
        .get('/list-measures/123?measure_type=INVALID');

      expect(response.status).toBe(400);
      expect(response.body.error_code).toBe('INVALID_TYPE');
    });

    it('should return 404 if no measures are found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/list-measures/123?measure_type=WATER');

      expect(response.status).toBe(404);
      expect(response.body.error_code).toBe('MEASURES_NOT_FOUND');
    });

    it('should return 200 and the list of measures on success', async () => {
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          { measure_uuid: 'uuid', measure_datetime: '2024-08-29T10:00:00Z', measure_type: 'WATER', has_confirmed: false, image_url: 'url' }
        ]
      });

      const response = await request(app)
        .get('/list-measures/123?measure_type=WATER');

      expect(response.status).toBe(200);
      expect(response.body.measures).toHaveLength(1);
      expect(response.body.measures[0]).toHaveProperty('measure_uuid', 'uuid');
    });
  });
});
