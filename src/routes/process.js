const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const { invokeProcessingLambda } = require('../services/lambdaService');
const { updateJobStatus } = require('../services/dynamoService');

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

module.exports = router;
