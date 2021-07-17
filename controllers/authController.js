const { getClientDetails } = require('../database/auth');
const { getDatabase } = require('../database/mongo');

const inRange = require('lodash.inrange');

const jwt = require('jsonwebtoken');

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY || 'c89cb6e00ed5fbcd8082fdb025c30a97-24e2ac64-1203415c',
    public_key: process.env.MAILGUN_PUBLIC_KEY || 'pubkey-029fdcc089cbea0b62313e1dfe513100'
});

const twilio = require('twilio');
const authToken = process.env.TWILIO_AUTH_TOKEN || '9605a22cb667a7832486388e0b3d5e3c';
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC56e10cf1e62aaedb940d74ff55fee8eb';
const twilioClient = new twilio(accountSid, authToken);

const usersCollectionName = 'users';
const tokensCollectionName = 'tokens';
const blacklistCollectionName = 'blacklist';

exports.auth_init = async function (req, res) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const clientData = await getClientDetails(auth);
    const validateReq = await validateAuthInit(req);
    if (!validateReq) {
        return res.status(400).json({ message: 'Invalid request' });
    } else {
        const authType = req.body.authType;
        const database = await getDatabase();
        const user = await getUserDetails(authType, authType === 'mobile' ? req.body.mobile : req.body.email, clientData);
        if (!user) {
            const coreData = {};
            if (req.body.email && req.body.email != null) {
                var emailValidation = await validateEmail(req.body.email, clientData);
                if (!emailValidation.proceed) {
                    return res.status(400).json({ message: emailValidation.isBlacklisted ? 'Email is blacklisted' : 'Invalid email address' });
                } else {
                    coreData.emailDomain = emailValidation.data.parts.domain; 
                    coreData.emailLocalPart = emailValidation.data.parts.local_part; 
                }
            }
            if (req.body.mobile && req.body.mobile != null) {
                var mobileValidation = await validateMobile(req.body.mobile, clientData);
                if (!mobileValidation.proceed) {
                    return res.status(400).json({ message: mobileValidation.isBlacklisted ? 'Mobile number is blacklisted' : 'Invalid mobile number' });
                } else {
                    coreData.countryCode = mobileValidation.data.countryCode;
                    coreData.mobileNationalFormat = mobileValidation.data.nationalFormat;
                    coreData.mobileCountryCode = mobileValidation.data.carrier.mobile_country_code;
                    coreData.mobileNetworkCode = mobileValidation.data.carrier.mobile_network_code;
                    coreData.mobileNetworkName = mobileValidation.data.carrier.name;
                }
            }
            await database.collection(usersCollectionName).insertOne({
                mobile: req.body.mobile ? req.body.mobile : null,
                email: req.body.email ? req.body.email : null,
                name: req.body.name ? req.body.name : null,
                data: {
                    allowed: true,
                    maxData: 1000
                },
                coreData: coreData,
                isMobileVerified: false,
                isEmailVerified: false,
                createdAt: new Date(),
                modifiedAt: new Date(),
                lastLogin: new Date(),
                client: clientData.name,
                clientId: clientData._id
            });
        }
        const twilioVerifyEnabled = clientData.twilioServices.verifyEnabled;
        if (twilioVerifyEnabled) {
            if (authType === 'mobile') {
                twilioClient.verify.services(clientData.twilioServices.verifyId).verifications.create({
                    to: req.body.mobile,
                    channel: 'sms'
                }).then(() => {
                    return res.json({ message: 'OTP SMS has been sent successfully' });
                }).catch(error => {
                    console.log(error);
                    return res.status(400).json({ message: 'Something went wrong while sending OTP - ' + error.code });
                });
            } else {
                twilioClient.verify.services(clientData.twilioServices.verifyId).verifications.create({
                    to: req.body.email,
                    channel: 'email'
                }).then(() => {
                    return res.json({ message: 'OTP email has been sent successfully' });
                }).catch(error => {
                    console.log(error);
                    return res.status(400).json({ message: 'Something went wrong while sending OTP - ' + error.code });
                });
            }
        } else {
            return res.status(400).json({ message: 'Client is not allowed to perform authentication services' });
        }
    }
};

exports.auth_verify = async function (req, res) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const clientData = await getClientDetails(auth);
    const validateReq = await validateAuthInit(req, true);
    if (!validateReq) {
        return res.status(400).json({ message: 'Invalid request' });
    } else {
        const authType = req.body.authType;
        const database = await getDatabase();
        const twilioVerifyEnabled = clientData.twilioServices.verifyEnabled;
        if (twilioVerifyEnabled) {
            twilioClient.verify.services(clientData.twilioServices.verifyId).verificationChecks.create({
                to: authType === 'mobile' ? req.body.mobile : req.body.email,
                code: req.body.code
            }).then(async (verification) => {
                if (verification.status === 'approved') {
                    var userUpdateFields = {
                        lastLogin: new Date()
                    };
                    var userSearchFields = {
                        clientId: clientData._id
                    };
                    if (authType === 'mobile') {
                        userUpdateFields['isMobileVerified'] = true;
                        userSearchFields['mobile'] = req.body.mobile;
                    } else {
                        userUpdateFields['isEmailVerified'] = true;
                        userSearchFields['email'] = req.body.email;
                    }
                    const user = await database.collection(usersCollectionName).findOneAndUpdate(userSearchFields, {
                        $set: userUpdateFields
                    }, {
                        returnDocument: 'after'
                    });
                    const userJwtToken = jwt.sign({ userId: user.value._id.toString() }, 'ipaas');
                    var tokenExpiry = new Date();
                    tokenExpiry.setDate(tokenExpiry.getDate() + 30);
                    await database.collection(tokensCollectionName).insertOne({
                        userJwtToken: userJwtToken,
                        clientId: clientData._id,
                        userId: user.value._id,
                        tokenExpiry: tokenExpiry
                    });
                    return res.json({
                        message: 'User has been verified successfully',
                        userId: user.value._id,
                        userData: user.value.data,
                        userJwtToken: userJwtToken,
                        tokenExpiry: tokenExpiry
                    });
                } else {
                    return res.status(400).json({ message: 'OTP verification failed, status is still ' + verification.status });
                }
            }).catch(error => {
                console.log(error);
                return res.status(400).json({ message: 'Something went wrong while verifying OTP - ' + error.code });
            });
        } else {
            return res.status(400).json({ message: 'Client is not allowed to perform authentication services' });
        }
    }
};

exports.auth_token = async function (req, res) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const clientData = await getClientDetails(auth);
    let token = req.headers['x-access-token'] || req.headers['authorization']; 
    if (token) {
        token = token.replace(/^Bearer\s+/, "");
        let bufferObj = Buffer.from(token, "base64");
        let userJwtToken = bufferObj.toString("utf8");
        var tokenDocument = await getTokenDetails(userJwtToken, clientData);
        if (tokenDocument) {
            if (tokenDocument.tokenExpiry > new Date()) {
                return res.json({
                    message: 'User session is still active',
                    tokenExpiry: tokenDocument.tokenExpiry,
                    userId: tokenDocument.userId
                });
            } else {
                return res.status(401).json({ message: 'JWT token has expired, re-initiate login' });
            }
        } else {
            return res.status(404).json({ message: 'No such JWT token is created' });
        }
    } else {
        return res.status(400).json({ message: 'Invalid request' });
    }
};

async function getTokenDetails(userJwtToken, clientData) {
    const database = await getDatabase();
    var tokenDocumentQuery = {
        clientId: clientData._id,
        userJwtToken: userJwtToken
    }
    const tokenDocument = await database.collection(tokensCollectionName).findOne(tokenDocumentQuery);
    return tokenDocument;
}

async function validateAuthInit(req, isCodeRequired = false) {
    if (isCodeRequired) {
        if (!req.body.code || req.body.code === null || !inRange(req.body.code.length, 3, 7)) return false;
    }
    if (!req || req == null || !req.body || req.body == null || !req.body.authType || req.body.authType == null) {
        return false;
    } else if (req.body.authType === 'mobile') {
        return !(!req.body.mobile || req.body.mobile === null || !inRange((Math.log(req.body.mobile) * Math.LOG10E + 1 | 0), 8, 14));
    } else if (req.body.authType === 'email') {
        return !(!req.body.email || req.body.email === null);
    } else {
        return false;
    }
}

async function getUserDetails(authType, identity, clientData) {
    const database = await getDatabase();
    var userDocument = {
        clientId: clientData._id,
    }
    userDocument[authType] = identity;
    const user = await database.collection(usersCollectionName).findOne(userDocument);
    return user;
}

async function validateMobile(mobile, clientData) {
    const database = await getDatabase();
    return new Promise(async function(resolve) {
        var blacklistedMobile = await database.collection(blacklistCollectionName).findOne({
            entity: mobile
        });
        if (blacklistedMobile) {
            resolve({
                data: null,
                proceed: false,
                isBlacklisted: true
            });
        }
        twilioClient.lookups.v1.phoneNumbers(mobile).fetch({
            type: ['carrier']
        }).then(data => {
            resolve({
                data: data,
                proceed: true,
                isBlacklisted: false
            });
        }).catch(async (error) => {
            database.collection(blacklistCollectionName).insertOne({
                entity: mobile,
                type: 'mobile',
                reason: error.moreInfo,
                createdAt: new Date(),
                client: clientData.name,
                clientId: clientData._id
            }, () => {
                resolve({
                    data: error,
                    proceed: false,
                    isBlacklisted: false
                });
            });
        });
    });
}

async function validateEmail(email, clientData) {
    const database = await getDatabase();
    return new Promise(async function(resolve) {
        var blacklistedEmail = await database.collection(blacklistCollectionName).findOne({
            entity: email
        });
        if (blacklistedEmail) {
            resolve({
                data: null,
                proceed: false,
                isBlacklisted: true
            });
        }
        mg.validate.get(email).then(data => {
            if (data.is_valid && !data.is_disposable_address) {
                resolve({
                    data: data,
                    proceed: true,
                    isBlacklisted: false
                });
            } else {
                database.collection(blacklistCollectionName).insertOne({
                    entity: email,
                    type: 'email',
                    reason: data.reason,
                    createdAt: new Date(),
                    client: clientData.name,
                    clientId: clientData._id
                }, () => {
                    resolve({
                        data: data,
                        proceed: false,
                        isBlacklisted: false
                    });
                });
            }
            
        }).catch(async (error) => {
            database.collection(blacklistCollectionName).insertOne({
                entity: email,
                type: 'email',
                createdAt: new Date(),
                client: clientData.name,
                clientId: clientData._id
            }, () => {
                resolve({
                    data: error,
                    proceed: false
                });
            });
        });
    });
}