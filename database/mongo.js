const { MongoClient } = require('mongodb');
const { logger } = require('../helpers/log4js');

async function startDatabase() {
    const mongoDBURL = process.env.MONGO_DB_URL;
    const connection = await MongoClient.connect(mongoDBURL, { useNewUrlParser: true, useUnifiedTopology: true });
    database = connection.db();
    logger.info('Successfully established connection to the database.')
}

async function getDatabase() {
    if (!database) await startDatabase();
    return database;
}

module.exports = {
    getDatabase,
    startDatabase,
};