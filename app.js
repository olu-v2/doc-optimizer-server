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
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', rateLimiter);
app.use('/api', authMiddleware);
app.use('/api', uploadRoutes);
app.use('/api', processRoutes);
app.use('/api', statusRoutes);
app.use('/api', downloadRoutes);
app.use('/admin', adminRoutes);
app.use('/', (req, res) => {
  res.send('Here');
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export const handler = serverlessExpress({ app });
