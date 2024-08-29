-- init.sql

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_uri VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS measures (
  measure_uuid UUID PRIMARY KEY,
  customer_code VARCHAR(50) NOT NULL,
  measure_datetime TIMESTAMPTZ NOT NULL,
  measure_type VARCHAR(50) NOT NULL,
  image_url VARCHAR(1024),
  measure_value INTEGER,
  confirmed_at TIMESTAMPTZ
);
