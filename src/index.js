const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const port = 3001;

app.use(helmet());
app.use(bodyParser.json());
app.use(cors());
app.use(morgan('combined'));

const { startDatabase } = require('../database/mongo');
const { validateUser, getUserDetails } = require('../database/auth');

app.get('/', isAuthorized, async (req, res) => {
  const user = await getUserDetails(req.headers.authorization);
  res.send(`Welcome, ${user.name}.`);
});

async function isAuthorized(req, res, next) {
  const auth = req.headers.authorization;
  const isValidUser = await validateUser(auth);
  if (isValidUser) {
    next();
  } else {
    res.status(401);
    res.send('Unauthorized');
  }
}

startDatabase().then(async () => {
  app.listen(port, async () => {
    console.log('IPaaS APIs are up and running.');
  });
});
