import express from 'express';
import { generateUploadUrl } from '../services/s3Service.js';
import { createJob } from '../services/dynamoService.js';
import { success, error } from '../utils/response.js';

const router = express.Router();

const allowedTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

router.post('/upload-url', async (req, res) => {
  try {
    const { contentType, optimizationLevel } = req.body;

    if (!contentType) return error(res, 'Content type required', 'CONTENT_TYPE_NOT_PROVIDED', 400);
    if (!allowedTypes.includes(contentType))
      return error(res, 'Only PDF and DOCX files are supported', 'INVALID_FILE_FORMAT', 400);
    if (!optimizationLevel)
      return error(res, 'optimizationLevel required', 'OPTIMIZATION_LEVEL', 400);

    const validLevels = ['low', 'medium', 'high'];
    if (!validLevels.includes(optimizationLevel)) {
      return error(
        res,
        'Optimization level must be low, medium or high',
        'INVALID_OPTIMIZATION_LEVEL',
        400
      );
    }

    const { uploadUrl, key, fileId } = await generateUploadUrl(contentType);

    // Create a job record in DynamoDB
    await createJob({ jobId: fileId, key, optimizationLevel, clientId: req.clientId });
    const data = {
      uploadUrl,
      key,
      jobId: fileId,
    };
    return success(res, data, 200);
  } catch (error) {
    console.error(error);
    return error(res, 'Failed to generate upload URL', 'URL_GENERATION_ERROR', 500);
  }
});

export default router;
