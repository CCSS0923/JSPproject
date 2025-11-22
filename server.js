require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs'); // [필수] 파일 삭제를 위해 필요
const db = require('./src/config/db');
const userRoutes = require('./src/routes/userRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'src/public')));

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/public/assets/');
  },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Routes
app.use('/api/users', userRoutes);

// [API] 파일 업로드
const uploadFields = upload.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 }
]);

app.post('/api/upload', uploadFields, (req, res) => {
  const { title, artist } = req.body;
  const files = req.files;

  if (!files.audioFile || !title || !artist) {
    return res.status(400).json({ message: '곡 제목, 아티스트, 오디오 파일은 필수입니다.' });
  }

  const audioFilename = files.audioFile[0].filename;
  const imageFilename = files.imageFile ? files.imageFile[0].filename : 'albumart.jpg';

  const audioSrc = `../assets/${audioFilename}`;
  const albumCover = `../assets/${imageFilename}`;

  const sql = `INSERT INTO tracks (title, artist, filename, album_cover) VALUES (?, ?, ?, ?)`;
  
  db.run(sql, [title, artist, audioSrc, albumCover], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'DB 저장 실패' });
    }
    console.log(`🎵 Track uploaded: ${title} by ${artist}`);
    res.status(200).json({ message: '업로드 성공!' });
  });
});

// [API] 트랙 목록 가져오기
app.get('/api/tracks', (req, res) => {
  const sql = `SELECT * FROM tracks ORDER BY id DESC`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const tracks = rows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: "Unknown Album",
      audioSrc: row.filename,
      albumCover: row.album_cover
    }));
    res.json(tracks);
  });
});

// [신규 API] 트랙 삭제 (DB + 파일 삭제)
app.delete('/api/tracks/:id', (req, res) => {
  const trackId = req.params.id;

  // 1. 삭제할 파일명을 먼저 조회
  db.get(`SELECT filename, album_cover FROM tracks WHERE id = ?`, [trackId], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB 조회 실패' });
    if (!row) return res.status(404).json({ message: '트랙을 찾을 수 없음' });

    // 2. 파일 경로 파악 (DB에는 '../assets/파일명' 형태로 저장됨)
    // 서버 실행 위치 기준으로 실제 파일 경로로 변환해야 함
    const audioPath = path.join(__dirname, 'src/public', row.filename.replace('../', ''));
    
    // 3. 오디오 파일 삭제
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`🗑️ Audio file deleted: ${audioPath}`);
    }

    // (선택) 이미지 파일 삭제: 기본 이미지(albumart.jpg)가 아닐 때만 삭제
    if (row.album_cover && !row.album_cover.includes('albumart.jpg')) {
        const imagePath = path.join(__dirname, 'src/public', row.album_cover.replace('../', ''));
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️ Image file deleted: ${imagePath}`);
        }
    }

    // 4. DB 데이터 삭제
    db.run(`DELETE FROM tracks WHERE id = ?`, [trackId], function(err) {
      if (err) return res.status(500).json({ message: 'DB 삭제 실패' });
      console.log(`🗑️ DB Record deleted (ID: ${trackId})`);
      res.status(200).json({ message: '삭제 성공' });
    });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/html/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));