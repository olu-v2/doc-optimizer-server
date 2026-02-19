const express = require('express');
const router = express.Router();
const { getJob } = require('../services/dynamoService');

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.jobId,
      status: job.status,
      optimizationLevel: job.optimizationLevel,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      errorMsg: job.errorMsg || null,
    });
  } catch (err) {
    console.err(err);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

module.exports = router;
