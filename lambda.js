'use strict';
const awsServerlessExpress = require('aws-serverless-express');
const app = require('./index');

console.log('Lambda file is loaded');

const server = awsServerlessExpress.createServer(app);
exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context)
