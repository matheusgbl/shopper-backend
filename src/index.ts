import express from 'express';
import measureRoutes from './routes/measureRoutes';
import bodyParser from 'body-parser';

const app = express();
const port: number = 3000;

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(measureRoutes);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
