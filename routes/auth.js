var express = require('express');
var router = express.Router();

var authController = require('../controllers/authController');

const { validateUser } = require('../database/auth');

router.post('/init', isAuthorized, authController.auth_init);
router.post('/verify', isAuthorized, authController.auth_verify);
router.post('/token', isAuthorized, authController.auth_token);

async function isAuthorized(req, res, next) {
    const auth = (req.headers.ipaas === undefined) ? req.query.ipaas : req.headers.ipaas;
    const isValidUser = await validateUser(auth);
    isValidUser ? next() : res.status(400).json({ message: 'User not authorised' });
}

module.exports = router;