require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const serverlessExpress = require('@vendia/serverless-express');
const auth = require('./src/middleware/auth');
const rateLimiter = require('./src/middleware/rateLimiter');

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', rateLimiter);
app.use('/api', auth);
app.use('/api', require('./src/routes/upload'));
app.use('/api', require('./src/routes/process'));
app.use('/api', require('./src/routes/status'));
app.use('/api', require('./src/routes/download'));
app.use('/admin', require('./src/routes/admin'));
app.use('/', (req, res) => {
  res.send('Here');
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

exports.handler = serverlessExpress({ app });
