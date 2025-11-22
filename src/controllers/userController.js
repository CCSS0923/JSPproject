// src/controllers/userController.js (수정됨)

const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

// 회원가입 로직 수정
exports.signup = (req, res) => {
  const { email, username, nickname, password } = req.body;
  if (!email || !username || !nickname || !password)
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });

  // 1. userModel.findDuplicates 함수 호출
  userModel.findDuplicates(email, username, nickname, (err, user) => {
    if (err) return res.status(500).json({ message: 'DB 조회 중 오류 발생: ' + err.message });

    // 2. 중복 검사 로직
    if (user) {
      if (user.email === email) {
        return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
      }
      if (user.username === username) {
        return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
      }
      if (user.nickname === nickname) {
        return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
      }
    }

    // 3. 중복이 없으면 사용자 생성
    const hash = bcrypt.hashSync(password, 10);
    userModel.createUser(email, username, nickname, hash, (err2) => {
      if (err2) return res.status(500).json({ message: '회원가입에 실패했습니다: ' + err2.message });
      res.status(201).json({ message: '회원가입 성공' });
    });
  });
};

// (login 함수는 이전과 동일)
exports.login = (req, res) => {
  const { loginId, password } = req.body;
  if (!loginId || !password)
    return res.status(400).json({ message: '아이디(이메일) 또는 비밀번호를 입력해주세요.' });

  userModel.findByLoginId(loginId, (err, user) => {
    if (err) return res.status(500).json({ message: 'DB 조회 중 오류 발생: ' + err.message });
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

    const match = bcrypt.compareSync(password, user.password);
    if (!match) return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });

    res.status(200).json({ 
      message: '로그인 성공', 
      user: {
        username: user.username,
        nickname: user.nickname,
        profile_image: user.profile_image
      } 
    });
  });
};