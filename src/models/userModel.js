// src/models/userModel.js (수정됨)

const db = require('../config/db');

// 로그인 시 아이디 또는 이메일로 사용자를 찾음
exports.findByLoginId = (loginId, callback) => {
  const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;
  db.get(sql, [loginId, loginId], callback);
};

// 회원가입 시 이메일, 아이디, 닉네임 중복 체크 (기존 findByEmailOrUsername 함수를 대체)
exports.findDuplicates = (email, username, nickname, callback) => {
  const sql = `SELECT * FROM users WHERE email = ? OR username = ? OR nickname = ?`;
  db.get(sql, [email, username, nickname], callback);
};

// 회원가입 시 사용자 생성
exports.createUser = (email, username, nickname, passwordHash, callback) => {
  const sql = `INSERT INTO users (email, username, nickname, password) VALUES (?, ?, ?, ?)`;
  db.run(sql, [email, username, nickname, passwordHash], callback);
};