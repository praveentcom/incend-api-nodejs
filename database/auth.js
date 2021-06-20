const { getDatabase } = require('./mongo');

const { ObjectID } = require('mongodb');

const collectionName = 'auth';

async function validateUser(authorization) {
    const database = await getDatabase();
    const user = await database.collection(collectionName).findOne({
        accessKey: authorization
    })
    return user != null;
}

async function getUserDetails(authorization) {
    const database = await getDatabase();
    const user = await database.collection(collectionName).findOne({
        accessKey: authorization
    })
    return user;
}

module.exports = {
    validateUser,
    getUserDetails
};