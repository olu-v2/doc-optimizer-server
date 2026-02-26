import express from 'express';
import multer from 'multer';
import { v4 as uuid4 } from 'uuid';
import { uploadToS3, generateDownloadUrl } from '../services/s3Service.js';
import { createJob, getJob } from '../services/dynamoService.js';
import { invokeProcessingLambda } from '../services/lambdaService.js';
import { success, error } from '../utils/response.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('INVALID FILE TYPE'));
    }
    cb(null, true);
  },
});

const VALID_LEVELS = ['low', 'medium', 'high'];
const POLL_INTERVAL = 2500;
const POLL_TIMEOUT = 60000;

const pollUntilDone = jobId =>
  new Promise((resolve, reject) => {
    const start = Date.now();

    const interval = setInterval(async () => {
      try {
        const job = await getJob(jobId);

        if (job?.status === 'DONE') {
          clearInterval(interval);
          return resolve(job);
        }

        if (job?.status === 'FAILED') {
          clearInterval(interval);
          return reject(new Error(job.errorMsg ?? 'Processing failed'));
        }

        if (Date.now() - start >= POLL_TIMEOUT) {
          clearInterval(interval);
          return reject(new Error('PROCESSING_TIMEOUT'));
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, POLL_INTERVAL);
  });

router.post('/optimize', upload.single('file'), async (req, res) => {
  try {
    const { optimizationLevel } = req.body;
    if (!optimizationLevel) {
      return error(res, 'optimizationLevel is required', 'MISSING_PARAMETERS', 400);
    }
    if (!VALID_LEVELS.includes(optimizationLevel)) {
      return error(
        res,
        'optimizationLevel must be low, medium or high',
        'INVALID_OPTIMIZATION_LEVEL',
        400
      );
    }

    if (!req.file) {
      return error(res, 'File is required', 'MISSING_FILE', 400);
    }

    const { buffer, mimetype, originalname } = req.file;
    const ext = mimetype === 'application/pdf' ? 'pdf' : 'docx';
    const jobId = uuid4();
    const key = `uploads/original/${jobId}.${ext}`;

    await uploadToS3(key, buffer, mimetype);

    await createJob({ jobId, key, optimizationLevel, clientId: req.clientId });

    await invokeProcessingLambda({ key, optimizationLevel, jobId });

    const job = await pollUntilDone(jobId);

    const downloadUrl = await generateDownloadUrl(job.outputKey);

    return success(res, { downloadUrl, jobId });
  } catch (err) {
    console.error(`[optimize] ${new Date().toISOString()}`, err.message);

    if (err.message === 'PROCESSING_TIMEOUT') {
      return error(res, 'Processing timed out. Try again.', 'PROCESSING_TIMEOUT', 504);
    }

    if (err.message === 'INVALID_FILE_TYPE') {
      return error(res, 'Only PDF and DOCX files are supported', 'INVALID_FILE_TYPE', 400);
    }

    return error(res, 'Optimization failed', 'OPTIMIZATION_FAILED', 500);
  }
});

export default router;
