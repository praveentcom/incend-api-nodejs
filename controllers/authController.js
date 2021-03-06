const { getClientDetails } = require('../database/auth');
const { getDatabase } = require('../database/mongo');
const { logger } = require('../helpers/log4js');

const inRange = require('lodash.inrange');

const jwt = require('jsonwebtoken');

const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: process.env.MAILGUN_API_USER,
    key: process.env.MAILGUN_API_KEY,
    public_key: process.env.MAILGUN_PUBLIC_KEY
});

const twilio = require('twilio');
const authToken = process.env.TWILIO_AUTH_TOKEN;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioClient = new twilio(accountSid, authToken);

const usersCollectionName = 'users';
const tokensCollectionName = 'tokens';
const blacklistCollectionName = 'blacklist';

exports.auth_init = async function (req, res) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const clientData = await getClientDetails(auth);
    const validateReq = await validateAuthInit(req);
    if (!validateReq) {
        logger.error('Send OTP - Invalid request from ' + clientData.name + " (" + clientData._id.toString() + ")");
        return res.status(400).json({ message: 'Invalid request' });
    } else {
        const authType = req.body.authType;
        if (authType === 'mobile') {
            if (req.body.mobile === process.env.TEST_MOBILE) {
                logger.warn('Send OTP - Buffer mobile OTP request from ' + clientData.name + " (" + clientData._id.toString() + ")");
                return res.json({ message: 'OTP SMS has been sent successfully' });
            }
        } else {
            if (req.body.email === process.env.TEST_EMAIL) {
                logger.warn('Send OTP - Buffer email OTP request from ' + clientData.name + " (" + clientData._id.toString() + ")");
                return res.json({ message: 'OTP email has been sent successfully' });
            }
        }
        const database = await getDatabase();
        const user = await getUserDetails(authType, authType === 'mobile' ? req.body.mobile : req.body.email, clientData);
        if (!user) {
            const coreData = {};
            if (req.body.email && req.body.email != null) {
                logger.info('Send OTP - Request received for email ' + req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                var emailValidation = await validateEmail(req.body.email, clientData);
                if (!emailValidation.proceed) {
                    logger.error('Send OTP - Aborted since email is invalid for ' + req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    return res.status(400).json({ message: emailValidation.isBlacklisted ? 'Email is blacklisted' : 'Invalid email address' });
                } else {
                    coreData.emailDomain = emailValidation.data.parts.domain; 
                    coreData.emailLocalPart = emailValidation.data.parts.local_part; 
                }
            }
            if (req.body.mobile && req.body.mobile != null) {
                logger.info('Send OTP - Request received for mobile ' + req.body.mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                var mobileValidation = await validateMobile(req.body.mobile, clientData);
                if (!mobileValidation.proceed) {
                    logger.error('Send OTP - Aborted since mobile is invalid for ' + req.body.mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
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
            logger.info('Send OTP - Created dormant account for ' + authType === 'mobile' ? req.body.mobile : req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
        }
        const twilioVerifyEnabled = clientData.twilioServices.verifyEnabled;
        if (twilioVerifyEnabled) {
            if (authType === 'mobile') {
                logger.info('Send OTP - Sending OTP SMS via Twilio for ' + req.body.mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                twilioClient.verify.services(clientData.twilioServices.verifyId).verifications.create({
                    to: req.body.mobile,
                    channel: 'sms'
                }).then(() => {
                    logger.info('Send OTP - Successfully sent OTP SMS via Twilio for ' + req.body.mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    return res.json({ message: 'OTP SMS has been sent successfully' });
                }).catch(error => {
                    logger.error('Send OTP - Failed to send OTP SMS via Twilio for ' + req.body.mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    logger.error('Send OTP - Twilio sent an status code ' + error.status + ' with error code ' + error.code + ' (' + error.moreInfo + ').');
                    return res.status(400).json({ message: 'Something went wrong while sending OTP - ' + error.code });
                });
            } else {
                logger.info('Send OTP - Sending OTP email via Twilio for ' + req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                twilioClient.verify.services(clientData.twilioServices.verifyId).verifications.create({
                    to: req.body.email,
                    channel: 'email'
                }).then(() => {
                    logger.info('Send OTP - Successfully sent OTP email via Twilio for ' + req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    return res.json({ message: 'OTP email has been sent successfully' });
                }).catch(error => {
                    logger.error('Send OTP - Failed to send OTP email via Twilio for ' + req.body.email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    logger.error('Send OTP - Twilio sent an status code ' + error.status + ' with error code ' + error.code + ' (' + error.moreInfo + ').');
                    return res.status(400).json({ message: 'Something went wrong while sending OTP - ' + error.code });
                });
            }
        } else {
            logger.error('Send OTP - Client is not allowed to perform authentication services / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return res.status(400).json({ message: 'Client is not allowed to perform authentication services' });
        }
    }
};

exports.auth_verify = async function (req, res) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const clientData = await getClientDetails(auth);
    const validateReq = await validateAuthInit(req, true);
    if (!validateReq) {
        logger.error('Verify OTP - Invalid request from ' + clientData.name + " (" + clientData._id.toString() + ")");
        return res.status(400).json({ message: 'Invalid request' });
    } else {
        const authType = req.body.authType;
        var entity;
        if (authType === 'mobile') {
            entity = req.body.mobile;
            if (req.body.mobile === process.env.TEST_MOBILE) {
                logger.warn('Verify OTP - Buffer mobile OTP request from ' + clientData.name + " (" + clientData._id.toString() + ")");
                return res.json({ message: 'OTP has been verified successfully' });
            }
        } else {
            entity = req.body.email;
            if (req.body.email === process.env.TEST_EMAIL) {
                logger.warn('Verify OTP - Buffer email OTP request from ' + clientData.name + " (" + clientData._id.toString() + ")");
                return res.json({ message: 'OTP has been verified successfully' });
            }
        }
        const database = await getDatabase();
        const twilioVerifyEnabled = clientData.twilioServices.verifyEnabled;
        if (twilioVerifyEnabled) {
            logger.info('Verify OTP - Request received for ' + entity + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            twilioClient.verify.services(clientData.twilioServices.verifyId).verificationChecks.create({
                to: entity,
                code: req.body.code
            }).then(async (verification) => {
                if (verification.status === 'approved') {
                    logger.info('Verify OTP - Successfully verified OTP via Twilio for ' + entity + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
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
                    logger.info('Verify OTP - Successfully generated JWT token for ' + entity + ' (' + user.value._id.toString() + ') / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    await database.collection(tokensCollectionName).insertOne({
                        userJwtToken: userJwtToken,
                        clientId: clientData._id,
                        userId: user.value._id,
                        tokenExpiry: tokenExpiry,
                        createdAt: new Date(),
                        modifiedAt: new Date()
                    });
                    return res.json({
                        message: 'User has been verified successfully',
                        userId: user.value._id,
                        name: user.value.name,
                        userData: user.value.data,
                        userJwtToken: userJwtToken,
                        tokenExpiry: tokenExpiry
                    });
                } else {
                    logger.error('Verify OTP - Failed to verify OTP via Twilio for ' + entity + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    logger.error('Verify OTP - Verification status received from Twilio for ' + entity + ' is ' + verification.status + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                    return res.status(400).json({ message: 'OTP verification failed, status is still ' + verification.status });
                }
            }).catch(error => {
                logger.error('Verify OTP - Failed to verify OTP via Twilio for ' + entity + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                logger.error('Verify OTP - Twilio sent an status code ' + error.status + ' with error code ' + error.code + ' (' + error.moreInfo + ').');
                return res.status(400).json({ message: 'Something went wrong while verifying OTP - ' + error.code });
            });
        } else {
            logger.error('Verify OTP - Client is not allowed to perform authentication services / ' + clientData.name + " (" + clientData._id.toString() + ")");
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
                logger.error('Validate Token - JWT token has already expired for the user / ' + clientData.name + " (" + clientData._id.toString() + ")");
                return res.status(401).json({ message: 'JWT token has already expired, re-initiate login' });
            }
        } else {
            logger.error('Validate Token - No such JWT token is created / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return res.status(404).json({ message: 'No such JWT token is created' });
        }
    } else {
        logger.error('Validate Token - Invalid request since the token is not sent / ' + clientData.name + " (" + clientData._id.toString() + ")");
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
            logger.error('Validate Mobile - Requested for blacklisted mobile ' + mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return resolve({
                data: null,
                proceed: false,
                isBlacklisted: true
            });
        }
        logger.info('Validate Mobile - Checking in Twilio for mobile ' + mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
        twilioClient.lookups.v1.phoneNumbers(mobile).fetch({
            type: ['carrier']
        }).then(data => {
            logger.info('Validate Mobile - Passed for mobile ' + mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return resolve({
                data: data,
                proceed: true,
                isBlacklisted: false
            });
        }).catch(async (error) => {
            logger.error('Validate Mobile - Failed and blacklisted for mobile ' + mobile + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            database.collection(blacklistCollectionName).insertOne({
                entity: mobile,
                type: 'mobile',
                reason: error.moreInfo,
                createdAt: new Date(),
                client: clientData.name,
                clientId: clientData._id
            }, () => {
                return resolve({
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
            logger.error('Validate Email - Requested for blacklisted email ' + email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return resolve({
                data: null,
                proceed: false,
                isBlacklisted: true
            });
        }
        logger.info('Validate Email - Checking in Mailgun for email ' + email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
        mg.validate.get(email).then(data => {
            if (data.is_valid && !data.is_disposable_address) {
                logger.info('Validate Email - Passed for email ' + email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                return resolve({
                    data: data,
                    proceed: true,
                    isBlacklisted: false
                });
            } else {
                logger.error('Validate Email - Failed and blacklisted for email ' + email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
                database.collection(blacklistCollectionName).insertOne({
                    entity: email,
                    type: 'email',
                    reason: data.reason,
                    createdAt: new Date(),
                    client: clientData.name,
                    clientId: clientData._id,
                    isDisposableAddress: data.is_disposable_address
                }, () => {
                    return resolve({
                        data: data,
                        proceed: false,
                        isBlacklisted: false
                    });
                });
            }
        }).catch(error => {
            logger.error('Validate Email - Proceeding since Mailgun check errored for email ' + email + ' / ' + clientData.name + " (" + clientData._id.toString() + ")");
            return resolve({
                data: error,
                error: error,
                proceed: true
            });
        });
    });
}