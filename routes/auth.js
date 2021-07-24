const { logger } = require('../helpers/log4js');

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

const { validateClient } = require('../database/auth');

router.post('/init', isAuthorized, authController.auth_init);
router.post('/verify', isAuthorized, authController.auth_verify);
router.get('/token', isAuthorized, authController.auth_token);

async function isAuthorized(req, res, next) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const isValidClient = await validateClient(auth);
    if (isValidClient) next();
    else {
        logger.error('An unknown identity is trying to access IPaaS without proper client API Key. ' + auth + ' is the API Key used.');
        res.status(400).json({ message: 'Client not authorised' });
    }
}

module.exports = router;
