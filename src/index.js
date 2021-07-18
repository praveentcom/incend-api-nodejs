const fs = require('fs');
const helmet = require('helmet');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const log4js = require('log4js');

const app = express();
const port = 3000;

const { startDatabase } = require('../database/mongo');
const { validateClient, getClientDetails } = require('../database/auth');
const { getSecret } = require('../helpers/awsSecrets');
const { logger, expressLogger } = require('../helpers/log4js');

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(log4js.connectLogger(expressLogger, {
  level: 'auto',
  format: (req, _res, format) => format(':method :url :status (' + req.headers.host  + ' :http-version :user-agent)')
}));

app.get('/', isAuthorized, async (req, res) => {
  const client = await getClientDetails((req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas);
  res.writeHead(200, { 'Content-Type':'text/html'});
  logger.info('Root Ping API was accessed by ' + client.name);
  html = fs.readFileSync(path.resolve(__dirname, '../static/index-authorised.html'));
  html = html.toString().replace('TEAM_NAME', client.name);
  html = html.toString().replace('RESPONSE_CODE', '200');
  html = html.toString().replace('RESPONSE_MESSAGE', 'OK');
  res.end(html);
});

async function isAuthorized(req, res, next) {
  const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
  const isValidClient = await validateClient(auth);
  if (isValidClient) {
    next();
  } else {
    res.writeHead(202, { 'Content-Type':'text/html'});
    logger.warn('Root Ping API was hit without proper client authentication.');
    html = fs.readFileSync(path.resolve(__dirname, '../static/index-unauthorised.html'));
    res.end(html);
  }
}

async function retrieveSecrets() {
  const secretString = await getSecret('ipaas_' + process.env.ENV);
  const credentials = JSON.parse(secretString);
  Object.keys(credentials).forEach(function(key) {
    process.env[key] = credentials[key];
  });
}

retrieveSecrets().then(() => {
  var authRouter = require('../routes/auth');
  var userRouter = require('../routes/user');
  app.use('/auth', authRouter);
  app.use('/user', userRouter);
  startDatabase().then(() => {
    app.listen(port, () => {
      logger.info('IPaaS APIs are up and running.');
    });
  });
});
