import express from 'express';
import { getJob } from '../services/dynamoService.js';
import { success, error } from '../utils/response.js';

const router = express.Router();

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await getJob(jobId);

    if (!job) {
      return error(res, 'Job not found', 'RESOURCE_DOES_NOT_EXIST', 404);
    }

    return success(res, {
      jobId: job.jobId,
      status: job.status,
      optimizationLevel: job.optimizationLevel,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      errorMsg: job.errorMsg || null,
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to retrieve job status', 'INTERNAL_ERROR', 500);
  }
});

export default router;
