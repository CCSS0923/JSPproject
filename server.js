require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
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

  const sql = `INSERT INTO tracks (title, artist, filename, album_cover, play_count) VALUES (?, ?, ?, ?, 0)`;
  
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
      albumCover: row.album_cover,
      playCount: row.play_count
    }));
    res.json(tracks);
  });
});

// [API] 재생 카운트 증가 및 히스토리 기록
app.post('/api/play', (req, res) => {
  const { trackId, userId } = req.body;

  if (!trackId) {
    return res.status(400).json({ message: 'Track ID is required' });
  }

  // 1. Tracks 테이블의 play_count 증가
  const updateSql = `UPDATE tracks SET play_count = play_count + 1 WHERE id = ?`;
  
  db.run(updateSql, [trackId], function(err) {
    if (err) {
      console.error('Play count update failed:', err);
      return res.status(500).json({ message: 'DB Error' });
    }

    // 2. 로그인 유저라면 History 테이블에 기록
    if (userId) {
      const historySql = `INSERT INTO play_history (user_id, track_id) VALUES (?, ?)`;
      db.run(historySql, [userId, trackId], (err2) => {
        if (err2) console.error('History logging failed:', err2.message);
      });
    }

    res.status(200).json({ message: 'Play recorded' });
  });
});

// [API] 트랙 삭제 (DB + 파일 삭제)
app.delete('/api/tracks/:id', (req, res) => {
  const trackId = req.params.id;

  db.get(`SELECT filename, album_cover FROM tracks WHERE id = ?`, [trackId], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB 조회 실패' });
    if (!row) return res.status(404).json({ message: '트랙을 찾을 수 없음' });

    const audioPath = path.join(__dirname, 'src/public', row.filename.replace('../', ''));
    
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`🗑️ Audio file deleted: ${audioPath}`);
    }

    if (row.album_cover && !row.album_cover.includes('albumart.jpg')) {
        const imagePath = path.join(__dirname, 'src/public', row.album_cover.replace('../', ''));
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`🗑️ Image file deleted: ${imagePath}`);
        }
    }

    db.run(`DELETE FROM tracks WHERE id = ?`, [trackId], function(err) {
      if (err) return res.status(500).json({ message: 'DB 삭제 실패' });
      console.log(`🗑️ DB Record deleted (ID: ${trackId})`);
      res.status(200).json({ message: '삭제 성공' });
    });
  });
});

// [API] 좋아요 토글 (Toggle)
app.post('/api/likes', (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) return res.status(400).json({ message: '필수 정보 누락' });

  // 1. 이미 좋아요를 눌렀는지 확인
  db.get(`SELECT id FROM likes WHERE user_id = ? AND track_id = ?`, [userId, trackId], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB Error' });

    if (row) {
      // 2-A. 이미 존재하면 -> 삭제 (좋아요 취소)
      db.run(`DELETE FROM likes WHERE id = ?`, [row.id], (err2) => {
        if (err2) return res.status(500).json({ message: '좋아요 취소 실패' });
        res.json({ liked: false, message: 'Unliked' });
      });
    } else {
      // 2-B. 없으면 -> 추가 (좋아요)
      db.run(`INSERT INTO likes (user_id, track_id) VALUES (?, ?)`, [userId, trackId], (err2) => {
        if (err2) return res.status(500).json({ message: '좋아요 실패' });
        res.json({ liked: true, message: 'Liked' });
      });
    }
  });
});

// [API] 특정 유저가 좋아요한 트랙 목록 가져오기
app.get('/api/users/:userId/likes', (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT t.*, t.play_count as playCount
    FROM tracks t
    JOIN likes l ON t.id = l.track_id
    WHERE l.user_id = ?
    ORDER BY l.created_at DESC
  `;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    
    const tracks = rows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: "Unknown Album",
      audioSrc: row.filename,
      albumCover: row.album_cover,
      playCount: row.play_count
    }));
    res.json(tracks);
  });
});

// [API] 현재 트랙의 좋아요 여부 확인
app.get('/api/likes/check', (req, res) => {
    const { userId, trackId } = req.query;
    db.get(`SELECT id FROM likes WHERE user_id = ? AND track_id = ?`, [userId, trackId], (err, row) => {
        if (err) return res.status(500).json({ message: 'DB Error' });
        res.json({ liked: !!row });
    });
});

// ... (기존 좋아요 API 아래에 추가) ...

// [API] 플레이리스트 생성
app.post('/api/playlists', (req, res) => {
  const { userId, title } = req.body;
  if (!userId || !title) return res.status(400).json({ message: '정보 누락' });

  const sql = `INSERT INTO playlists (user_id, title) VALUES (?, ?)`;
  db.run(sql, [userId, title], function(err) {
    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json({ id: this.lastID, title, message: 'Playlist created' });
  });
});

// [API] 유저의 플레이리스트 목록 조회
app.get('/api/users/:userId/playlists', (req, res) => {
  const sql = `SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC`;
  db.all(sql, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json(rows);
  });
});

// [API] 특정 플레이리스트 상세(곡 목록 포함) 조회
app.get('/api/playlists/:id', (req, res) => {
  const playlistId = req.params.id;
  
  // 1. 플레이리스트 정보
  db.get(`SELECT * FROM playlists WHERE id = ?`, [playlistId], (err, playlist) => {
    if (err || !playlist) return res.status(404).json({ message: 'Playlist not found' });

    // 2. 포함된 곡 목록
    const trackSql = `
      SELECT t.*, t.play_count as playCount
      FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.order_num ASC, pt.added_at ASC
    `;
    
    db.all(trackSql, [playlistId], (err2, tracks) => {
      if (err2) return res.status(500).json({ message: 'DB Error' });
      
      // 클라이언트 포맷 매핑
      const formattedTracks = tracks.map(row => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: "Unknown Album",
        audioSrc: row.filename,
        albumCover: row.album_cover,
        playCount: row.play_count
      }));

      res.json({ ...playlist, tracks: formattedTracks });
    });
  });
});

// [API] 플레이리스트에 곡 추가
app.post('/api/playlists/:id/tracks', (req, res) => {
  const playlistId = req.params.id;
  const { trackId } = req.body;

  // 중복 체크 (선택 사항)
  db.get(`SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`, [playlistId, trackId], (err, row) => {
    if (row) return res.status(409).json({ message: 'Already in playlist' });

    const sql = `INSERT INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)`;
    db.run(sql, [playlistId, trackId], (err2) => {
      if (err2) return res.status(500).json({ message: 'DB Error' });
      res.json({ message: 'Track added' });
    });
  });
});

// [API] 플레이리스트에서 곡 삭제
app.delete('/api/playlists/:pid/tracks/:tid', (req, res) => {
    const { pid, tid } = req.params;
    db.run(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`, [pid, tid], (err) => {
        if (err) return res.status(500).json({ message: 'DB Error' });
        res.json({ message: 'Deleted' });
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/html/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));