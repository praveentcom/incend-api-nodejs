const { MongoClient } = require('mongodb');

async function startDatabase() {
    const mongoDBURL = process.env.MONGO_DB_URL;
    const connection = await MongoClient.connect(mongoDBURL, { useNewUrlParser: true, useUnifiedTopology: true });
    database = connection.db();
}

async function getDatabase() {
    if (!database) await startDatabase();
    return database;
}

module.exports = {
    getDatabase,
    startDatabase,
};