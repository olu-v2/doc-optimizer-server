import express from 'express';
import { success, error } from '../utils/response.js';
import { invokeProcessingLambda } from '../services/lambdaService.js';
import { updateJobStatus } from '../services/dynamoService.js';

const router = express.Router();
router.post('/process', async (req, res) => {
  try {
    const { key, optimizationLevel, jobId } = req.body;

    if (!key || !optimizationLevel) {
      return res.status(400).json({ error: 'Missing parameters: key, optimizationLevel, jobId' });
    }

    await updateJobStatus(jobId, 'PENDING');
    await invokeProcessingLambda({ key, optimizationLevel, jobId });
    success(res, { message: 'Processing started', jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Processing failed to start' });
  }
});

export default router;
