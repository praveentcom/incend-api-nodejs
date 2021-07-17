const { getDatabase } = require('./mongo');

const collectionName = 'auth';

async function validateUser(ipaasKey) {
    const database = await getDatabase();
    const user = await database.collection(collectionName).findOne({
        accessKey: ipaasKey
    });
    return user != null;
}

async function getClientDetails(ipaasKey) {
    const database = await getDatabase();
    const user = await database.collection(collectionName).findOne({
        accessKey: ipaasKey
    });
    return user;
}

module.exports = {
    validateUser,
    getClientDetails
};