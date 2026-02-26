import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import serverlessExpress from '@vendia/serverless-express';
import { authMiddleware } from './src/middleware/auth.js';
import { rateLimiter } from './src/middleware/rateLimiter.js';
import uploadRoutes from './src/routes/upload.js';
import processRoutes from './src/routes/process.js';
import statusRoutes from './src/routes/status.js';
import downloadRoutes from './src/routes/download.js';
import adminRoutes from './src/routes/admin.js';
import optimizeRoutes from './src/routes/optimize.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5500;

app.set('trust proxy', 1);
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', rateLimiter);
app.use('/api', authMiddleware);
app.use('/api', uploadRoutes);
app.use('/api', processRoutes);
app.use('/api', statusRoutes);
app.use('/api', downloadRoutes);
app.use('/api', optimizeRoutes);
app.use('/admin', adminRoutes);
app.use('/', (req, res) => {
  res.send('Here');
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: { message: 'File exceeds the 2MB limit', code: 'FILE_TOO_LARGE' },
      timestamp: new Date().toISOString(),
    });
  }
  if (err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: { message: 'Only PDF and DOCX files are supported', code: 'INVALID_FILE_TYPE' },
      timestamp: new Date().toISOString(),
    });
  }
  next(err);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export const handler = serverlessExpress({ app });
