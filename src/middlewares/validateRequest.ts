import { Request, Response, NextFunction } from 'express';

export function validateRequest(req: Request, res: Response, next: NextFunction) {
  const { image, customer_code, measure_datetime, measure_type } = req.body;
  
  if (!image || !customer_code || !measure_datetime || !measure_type) {
    return res.status(400).json({
      error_code: 'INVALID_DATA',
      error_description: 'Missing required fields',
    });
  }

  next();
}
