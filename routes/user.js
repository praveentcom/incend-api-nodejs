var express = require('express');
var router = express.Router();

var userController = require('../controllers/userController');

router.get('/', userController.get_profile);
router.post('/edit', userController.edit_profile);

module.exports = router;