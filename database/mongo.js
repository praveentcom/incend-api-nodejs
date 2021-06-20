const {MongoClient} = require('mongodb');

async function startDatabase() {
    const mongoDBURL = "mongodb+srv://incend-db-api:tHq4bOLDHY9gPs3x@ipaas-prod.qgdzu.mongodb.net/IPaaS-Prod?retryWrites=true&w=majority"
    const connection = await MongoClient.connect(mongoDBURL, {useNewUrlParser: true, useUnifiedTopology: true});
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