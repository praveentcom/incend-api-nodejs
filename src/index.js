const fs = require('fs');
const helmet = require('helmet');
const express = require('express');
const bodyParser = require('body-parser');
const path = require("path");
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

var authRouter = require('../routes/auth');

app.use('/auth', authRouter);

const { startDatabase } = require('../database/mongo');
const { validateUser, getClientDetails } = require('../database/auth');

app.get('/', isAuthorized, async (req, res) => {
  const user = await getClientDetails((req.headers.authorization === undefined) ? req.query.authorization : req.headers.authorization);
  res.writeHead(200, { 'Content-Type':'text/html'});
  html = fs.readFileSync(path.resolve(__dirname, '../static/index-authorised.html'));
  html = html.toString().replace('TEAM_NAME', user.name);
  html = html.toString().replace('RESPONSE_CODE', '200');
  html = html.toString().replace('RESPONSE_MESSAGE', 'OK');
  res.end(html);
});

async function isAuthorized(req, res, next) {
  const auth = (req.headers.authorization === undefined) ? req.query.authorization : req.headers.authorization;
  const isValidUser = await validateUser(auth);
  if (isValidUser) {
    next();
  } else {
    res.writeHead(202, { 'Content-Type':'text/html'});
    html = fs.readFileSync(path.resolve(__dirname, '../static/index-unauthorised.html'));
    res.end(html);
  }
}

startDatabase().then(async () => {
  app.listen(port, async () => {
    console.log('IPaaS APIs are up and running.');
  });
});
