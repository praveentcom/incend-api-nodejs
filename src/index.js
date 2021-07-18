const fs = require('fs');
const helmet = require('helmet');
const express = require('express');
const bodyParser = require('body-parser');
const path = require("path");
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = 3000;

const { startDatabase } = require('../database/mongo');
const { validateUser, getClientDetails } = require('../database/auth');
const { getSecret } = require('../helpers/awsSecrets');

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

app.get('/', isAuthorized, async (req, res) => {
  const user = await getClientDetails((req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas);
  res.writeHead(200, { 'Content-Type':'text/html'});
  html = fs.readFileSync(path.resolve(__dirname, '../static/index-authorised.html'));
  html = html.toString().replace('TEAM_NAME', user.name);
  html = html.toString().replace('RESPONSE_CODE', '200');
  html = html.toString().replace('RESPONSE_MESSAGE', 'OK');
  res.end(html);
});

async function isAuthorized(req, res, next) {
  const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
  const isValidUser = await validateUser(auth);
  if (isValidUser) {
    next();
  } else {
    res.writeHead(202, { 'Content-Type':'text/html'});
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
      console.log('IPaaS APIs are up and running.');
    });
  });
});
