const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

exports.signup = (req, res) => {
  const { email, username, nickname, password } = req.body;
  if (!email || !username || !nickname || !password)
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });

  userModel.findDuplicates(email, username, nickname, (err, user) => {
    if (err) return res.status(500).json({ message: 'DB 조회 중 오류 발생: ' + err.message });

    if (user) {
      if (user.email === email) return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
      if (user.username === username) return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
      if (user.nickname === nickname) return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    userModel.createUser(email, username, nickname, hash, (err2) => {
      if (err2) return res.status(500).json({ message: '회원가입 실패: ' + err2.message });
      res.status(201).json({ message: '회원가입 성공' });
    });
  });
};

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
        id: user.id, // [중요] DB 연동을 위해 ID 포함
        username: user.username,
        nickname: user.nickname,
        profile_image: user.profile_image
      } 
    });
  });
};

exports.deleteUser = (req, res) => {
  const userId = req.params.id;

  // 유효성 검사 (선택 사항: 본인 확인 로직 등이 들어갈 수 있음)
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  userModel.deleteUser(userId, (err) => {
    if (err) {
      console.error('Delete user failed:', err);
      return res.status(500).json({ message: '계정 삭제 중 오류가 발생했습니다.' });
    }
    res.status(200).json({ message: '계정이 성공적으로 삭제되었습니다.' });
  });
};