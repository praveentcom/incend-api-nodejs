const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const port = 3000;

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

const { startDatabase } = require('../database/mongo');
const { validateUser, getUserDetails } = require('../database/auth');

app.get('/', isAuthorized, async (req, res) => {
  const user = await getUserDetails((req.headers.authorization === undefined) ? req.query.authorization : req.headers.authorization);
  res.writeHead(200, { 'Content-Type':'text/html'});
  html = fs.readFileSync('./static/index-authorised.html');
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
    res.writeHead(401, { 'Content-Type':'text/html'});
    html = fs.readFileSync('./static/index-unauthorised.html');
    res.end(html);
  }
}

startDatabase().then(async () => {
  app.listen(port, async () => {
    console.log('IPaaS APIs are up and running.');
  });
});
