export interface MeasureRequestBody {
  image: string;
  customer_code: string;
  measure_datetime: string;
  measure_type: 'WATER' | 'GAS';
}

export interface MeasureResponse {
  image_url: string;
  measure_value: number;
  measure_uuid: string;
}

export interface ErrorResponse {
  error_code: string;
  error_description: string;
}

export interface ConfirmRequestBody {
  measure_uuid: string;
  confirmed_value: number;
}
