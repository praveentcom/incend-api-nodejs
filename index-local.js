const index = require('./index');

index.handler('debug', null).then(status => {
  console.log(status);
});