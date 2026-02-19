const express = require('express');
const router = express.Router();
const { getJob } = require('../services/dynamoService');
const { generateDownloadUrl } = require('../services/s3Service');

router.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'DONE') {
      return res.status(400).json({
        error: 'File is not ready yet',
        status: job.status,
      });
    }

    const downloadUrl = await generateDownloadUrl(job.outputKey);
    res.json({ downloadUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

module.exports = router;
