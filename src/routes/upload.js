import express from 'express';
import { generateUploadUrl } from '../services/s3Service.js';
import { createJob } from '../services/dynamoService.js';

const router = express.Router();

router.post('/upload-url', async (req, res) => {
  try {
    const { contentType, optimizationLevel } = req.body;

    if (!contentType) return res.status(400).json({ error: 'Content type required' });
    if (!optimizationLevel) return res.status(400).json({ error: 'optimizationLevel required' });

    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(optimizationLevel)) {
      return res.status(400).json({ error: 'optimizationLevel must be low, medium, or high' });
    }

    const { uploadUrl, key, fileId } = await generateUploadUrl(contentType);

    // Create a job record in DynamoDB
    await createJob({ jobId: fileId, key, optimizationLevel });

    res.json({ uploadUrl, key, jobId: fileId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

export default router;
