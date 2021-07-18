const { getDatabase } = require('./mongo');

const collectionName = 'auth';

async function validateClient(ipaasKey) {
    const database = await getDatabase();
    const client = await database.collection(collectionName).findOne({
        accessKey: ipaasKey
    });
    return client != null;
}

async function getClientDetails(ipaasKey) {
    const database = await getDatabase();
    const client = await database.collection(collectionName).findOne({
        accessKey: ipaasKey
    });
    return client;
}

module.exports = {
    validateClient,
    getClientDetails
};