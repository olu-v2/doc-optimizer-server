import express from 'express';
import { getJob } from '../services/dynamoService.js';
import { generateDownloadUrl } from '../services/s3Service.js';
import { error, success } from '../utils/response.js';

const router = express.Router();

router.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return error(res, 'Job not found', 'RESOURCE_DOES_NOT_EXIST', 404);
    }

    if (job.status !== 'DONE') {
      return error(res, `File not ready ${job.status}`, 'FILE_NOT_READY_FOR_DOWNLOAD', 400);
    }

    const downloadUrl = await generateDownloadUrl(job.outputKey);
    return success(res, { downloadUrl }, 200);
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to generate download URL', 'FAILED_TO_GENERATE_URL', 500);
  }
});

export default router;
