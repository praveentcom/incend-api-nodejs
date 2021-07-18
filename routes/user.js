const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');

router.get('/', userController.get_profile);
router.post('/edit', userController.edit_profile);

module.exports = router;