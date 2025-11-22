// src/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/signup', userController.signup);
router.post('/login', userController.login);

// [추가됨] 회원 탈퇴 라우트
router.delete('/:id', userController.deleteUser);

module.exports = router;