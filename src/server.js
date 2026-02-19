require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const serverlessExpress = require('@vendia/serverless-express');
const auth = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();

app.use('/api', auth);
app.use('/api', rateLimiter);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use('/api', require('./routes/upload'));
app.use('/api', require('./routes/process'));
app.use('/api', require('./routes/status'));
app.use('/api', require('./routes/download'));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

exports.handler = serverlessExpress({ app });
