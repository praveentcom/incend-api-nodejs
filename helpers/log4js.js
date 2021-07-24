const { configure, getLogger } = require('log4js');

var layout = {
    type: 'pattern',
    pattern: '%p - %m'
}

configure({
    appenders: {
        console: {
            type: 'console',
            layout: layout
        },
        aws: {
            type: 'log4js-cloudwatch-appender',
            region: 'ap-south-1',
            logGroup: 'ipaas-' + process.argv.slice(2),
            logStream: 'api-logs',
            layout: layout
        },
        aws_express: {
            type: 'log4js-cloudwatch-appender',
            region: 'ap-south-1',
            logGroup: 'ipaas-' + process.argv.slice(2),
            logStream: 'api-calls',
            layout: layout
        }
    },
    categories: {
        default: { appenders: ['aws', 'console'], level: 'trace' },
        aws_express: { appenders: ['aws_express'], level: 'trace' },
    }
});

const logger = getLogger();
const expressLogger = getLogger('aws_express');

module.exports = { logger, expressLogger };