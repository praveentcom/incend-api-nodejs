const { getDatabase } = require('../database/mongo');

const usersCollectionName = 'users';
const tokensCollectionName = 'tokens';

exports.edit_profile = async function (req, res) {
    let token = req.headers['x-access-token'] || req.headers['authorization'];
    var checkEditRequest = validateProfileEdit(req);
    if (!checkEditRequest) {
        return res.status(400).json({ message: 'Invalid request' });
    }
    if (token) {
        token = token.replace(/^Bearer\s+/, "");
        let bufferObj = Buffer.from(token, "base64");
        let userJwtToken = bufferObj.toString("utf8");
        var tokenDocument = await getTokenDetails(userJwtToken);
        if (tokenDocument) {
            if (tokenDocument.tokenExpiry > new Date()) {
                var user = await updateUserDetails(tokenDocument.userId, req);
                return res.json({
                    message: 'User profile details are updated',
                    tokenExpiry: tokenDocument.tokenExpiry,
                    userId: tokenDocument.userId,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    isEmailVerified: user.isEmailVerified,
                    isMobileVerified: user.isMobileVerified
                });
            } else {
                return res.status(401).json({ message: 'JWT token has expired, re-initiate login' });
            }
        } else {
            return res.status(404).json({ message: 'No such JWT token is created' });
        }
    } else {
        return res.status(401).json({ message: 'Invalid JWT token' });
    }
}

exports.get_profile = async function (req, res) {
    let token = req.headers['x-access-token'] || req.headers['authorization']; 
    if (token) {
        token = token.replace(/^Bearer\s+/, "");
        let bufferObj = Buffer.from(token, "base64");
        let userJwtToken = bufferObj.toString("utf8");
        var tokenDocument = await getTokenDetails(userJwtToken);
        if (tokenDocument) {
            if (tokenDocument.tokenExpiry > new Date()) {
                var user = await getUserDetails(tokenDocument.userId);
                var timeDifference = new Date().getTime() - tokenDocument.tokenExpiry.getTime();
                var dayDifference = timeDifference / (1000 * 60 * 60 * 24);
                if (dayDifference < 7) {
                    const database = await getDatabase();
                    var newTokenExpiry = new Date();
                    newTokenExpiry.setDate(newTokenExpiry.getDate() + 30);
                    await database.collection(tokensCollectionName).findOneAndUpdate({
                        userJwtToken: userJwtToken
                    }, {
                        $set: {
                            tokenExpiry: newTokenExpiry,
                            modifiedAt: new Date()
                        }
                    });
                }
                return res.json({
                    message: 'User session is still active',
                    tokenExpiry: tokenDocument.tokenExpiry,
                    userId: tokenDocument.userId,
                    name: user.name,
                    email: user.email,
                    mobile: user.mobile,
                    isEmailVerified: user.isEmailVerified,
                    isMobileVerified: user.isMobileVerified
                });
            } else {
                return res.status(401).json({ message: 'JWT token has expired, re-initiate login' });
            }
        } else {
            return res.status(404).json({ message: 'No such JWT token is created' });
        }
    } else {
        return res.status(401).json({ message: 'Invalid JWT token' });
    }
}

async function getTokenDetails(userJwtToken) {
    const database = await getDatabase();
    var tokenDocumentQuery = {
        userJwtToken: userJwtToken
    }
    const tokenDocument = await database.collection(tokensCollectionName).findOne(tokenDocumentQuery);
    return tokenDocument;
}

function validateProfileEdit(req) {
    return !(!req || req == null || !req.body || req.body == null || !req.body.name || req.body.name == null);
}

async function getUserDetails(userId) {
    const database = await getDatabase();
    var userDocument = {
        _id: userId
    }
    const user = await database.collection(usersCollectionName).findOne(userDocument);
    return user;
}

async function updateUserDetails(userId, req) {
    const database = await getDatabase();
    var userDocument = {
        _id: userId
    }
    const user = await database.collection(usersCollectionName).findOneAndUpdate(userDocument, {
        $set: {
            name: req.body.name
        }
    }, {
        returnDocument: 'after'
    });
    return user.value;
}
