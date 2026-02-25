import express from 'express';
import { success, error } from '../utils/response.js';
import { invokeProcessingLambda } from '../services/lambdaService.js';
import { updateJobStatus } from '../services/dynamoService.js';

const router = express.Router();
router.post('/process', async (req, res) => {
  try {
    const { key, optimizationLevel, jobId } = req.body;

    if (!key || !optimizationLevel || jobId) {
      return error('Missing parameters: key, optimizationLevel, jobId', 'MISSING_PARAMETERS', 400);
    }

    await updateJobStatus(jobId, 'PENDING');
    await invokeProcessingLambda({ key, optimizationLevel, jobId });
    return success(res, { message: 'Processing started', jobId });
  } catch (err) {
    console.error(err);
    return (res, 'Processing failed to start', 'PROCESSING_FAILED', 500);
  }
});

export default router;
