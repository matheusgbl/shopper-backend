import { Router } from 'express';
import { uploadMeasure, confirmMeasureController, listMeasuresController } from '../controllers/measureController';
import { validateRequest } from '../middlewares/validateRequest';

const router = Router();

router.post('/upload', validateRequest, uploadMeasure);
router.patch('/confirm', confirmMeasureController);
router.get('/:customer_code/list', listMeasuresController);

export default router;
