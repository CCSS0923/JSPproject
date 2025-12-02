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

// ======================
// Middleware
// ======================
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ======================
// Static files
// ======================
app.use(express.static(path.join(__dirname, "src/public")));


// ======================
// Multer (파일 업로드)
// ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/public/assets/');
  },
  filename: (req, file, cb) => {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Date.now() + '_' + file.originalname);
  }
});
const upload = multer({ storage });


// ======================
// Routes - Users
// ======================
app.use('/api/users', userRoutes);


// ======================
// [API] 파일 업로드
// ======================
const uploadFields = upload.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 }
]);

app.post('/api/upload', uploadFields, (req, res) => {
  const { title, artist, album } = req.body;
  const files = req.files;

  if (!files.audioFile || !title || !artist) {
    return res.status(400).json({ message: '곡 제목, 아티스트, 오디오 파일은 필수입니다.' });
  }

  const audioFilename = files.audioFile[0].filename;
  const imageFilename = files.imageFile ? files.imageFile[0].filename : 'albumart.jpg';

  // 절대경로로 변경
  const audioSrc = `/assets/${audioFilename}`;
  const albumCover = `/assets/${imageFilename}`;
  const albumName = album && album.trim() ? album.trim() : 'Unknown Album';

  const sql = `
      INSERT INTO tracks (title, artist, album, filename, album_cover, play_count)
      VALUES (?, ?, ?, ?, ?, 0)
  `;

  db.run(sql, [title, artist, albumName, audioSrc, albumCover], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'DB 저장 실패' });
    }

    console.log(`🎵 Track uploaded: ${title} by ${artist}`);
    res.status(200).json({ message: '업로드 성공!' });
  });
});


// ======================
// [API] 트랙 목록
// ======================
app.get('/api/tracks', (req, res) => {
  const sql = `SELECT * FROM tracks ORDER BY id DESC`;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const tracks = rows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album || "Unknown Album",
      audioSrc: row.filename,
      albumCover: row.album_cover,
      playCount: row.play_count
    }));
    res.json(tracks);
  });
});


// ======================
// [API] 재생 기록 & 플레이 카운트
// ======================
app.post('/api/play', (req, res) => {
  const { trackId, userId } = req.body;

  if (!trackId) {
    return res.status(400).json({ message: 'Track ID is required' });
  }

  const updateSql = `
      UPDATE tracks SET play_count = play_count + 1 WHERE id = ?
  `;

  db.run(updateSql, [trackId], function(err) {
    if (err) {
      console.error('Play count update failed:', err);
      return res.status(500).json({ message: 'DB Error' });
    }

    if (userId) {
      const historySql = `
          INSERT INTO play_history (user_id, track_id) VALUES (?, ?)
      `;
      db.run(historySql, [userId, trackId], (err2) => {
        if (err2) console.error('History logging failed:', err2.message);
      });
    }

    res.status(200).json({ message: 'Play recorded' });
  });
});


// ======================
// [API] 트랙 삭제
// ======================
app.delete('/api/tracks/:id', (req, res) => {
  const trackId = req.params.id;

  db.get(`
        SELECT filename, album_cover FROM tracks WHERE id = ?
    `, [trackId], (err, row) => {

    if (err) return res.status(500).json({ message: 'DB 조회 실패' });
    if (!row) return res.status(404).json({ message: '트랙을 찾을 수 없음' });

    const audioPath = path.join(__dirname, 'src/public', row.filename.replace('/assets', 'assets'));

    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log(`🗑️ Audio file deleted: ${audioPath}`);
    }

    if (row.album_cover && !row.album_cover.includes('albumart.jpg')) {
      const imagePath = path.join(__dirname, 'src/public', row.album_cover.replace('/assets', 'assets'));
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


// ======================
// [API] 좋아요 토글
// ======================
app.post('/api/likes', (req, res) => {
  const { userId, trackId } = req.body;
  if (!userId || !trackId) return res.status(400).json({ message: '필수 정보 누락' });

  db.get(`
        SELECT id FROM likes WHERE user_id = ? AND track_id = ?
    `, [userId, trackId], (err, row) => {

    if (err) return res.status(500).json({ message: 'DB Error' });

    if (row) {
      db.run(`DELETE FROM likes WHERE id = ?`, [row.id], (err2) => {
        if (err2) return res.status(500).json({ message: '좋아요 취소 실패' });
        res.json({ liked: false, message: 'Unliked' });
      });
    } else {
      db.run(`
                INSERT INTO likes (user_id, track_id) VALUES (?, ?)
            `, [userId, trackId], (err2) => {

        if (err2) return res.status(500).json({ message: '좋아요 실패' });
        res.json({ liked: true, message: 'Liked' });
      });
    }
  });
});


// ======================
// [API] 좋아요 목록
// ======================
app.get('/api/users/:userId/likes', (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT t.*, t.play_count AS playCount
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
      album: row.album || "Unknown Album",
      audioSrc: row.filename,
      albumCover: row.album_cover,
      playCount: row.play_count
    }));

    res.json(tracks);
  });
});

// ======================
// [API] 인기 아티스트 (재생 수 기준)
// ======================
app.get('/api/artists/popular', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 8;

  const sql = `
    SELECT 
      t.artist AS artist,
      SUM(t.play_count) AS totalPlays,
      (
        SELECT t2.album_cover 
        FROM tracks t2 
        WHERE t2.artist = t.artist 
        ORDER BY t2.play_count DESC, t2.id DESC 
        LIMIT 1
      ) AS albumCover
    FROM tracks t
    GROUP BY t.artist
    ORDER BY totalPlays DESC
    LIMIT ?
  `;

  db.all(sql, [limit], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    const artists = rows.map(row => ({
      artist: row.artist,
      albumCover: row.albumCover || '/assets/albumart.jpg',
      totalPlays: row.totalPlays || 0
    }));
    res.json(artists);
  });
});

// ======================
// [API] 최근 재생 목록 (좌→우 최신순)
// ======================
app.get('/api/users/:userId/recent-plays', (req, res) => {
  const userId = req.params.userId;

  const sql = `
    SELECT t.*, MAX(h.played_at) AS lastPlayed
    FROM play_history h
    JOIN tracks t ON t.id = h.track_id
    WHERE h.user_id = ?
    GROUP BY t.id
    ORDER BY lastPlayed DESC
    LIMIT 15
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
      playCount: row.play_count,
      lastPlayed: row.lastPlayed
    }));

    res.json(tracks);
  });
});

// ======================
// [API] 팔로잉 (아티스트) 토글 및 조회
// ======================
app.post('/api/follow', (req, res) => {
  const { userId, artist } = req.body;
  if (!userId || !artist) return res.status(400).json({ message: '필수 정보 누락' });

  db.get(`SELECT id FROM follows WHERE user_id = ? AND artist = ?`, [userId, artist], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB Error' });

    if (row) {
      db.run(`DELETE FROM follows WHERE id = ?`, [row.id], (err2) => {
        if (err2) return res.status(500).json({ message: '언팔로우 실패' });
        res.json({ following: false });
      });
    } else {
      db.run(`INSERT INTO follows (user_id, artist) VALUES (?, ?)`, [userId, artist], (err2) => {
        if (err2) return res.status(500).json({ message: '팔로우 실패' });
        res.json({ following: true });
      });
    }
  });
});

app.get('/api/users/:userId/following', (req, res) => {
  const userId = req.params.userId;
  const sql = `
    SELECT f.artist,
           (
              SELECT t.album_cover FROM tracks t
              WHERE t.artist = f.artist
              ORDER BY t.play_count DESC, t.id DESC
              LIMIT 1
           ) AS albumCover,
           (
              SELECT t.id FROM tracks t
              WHERE t.artist = f.artist
              ORDER BY t.id DESC
              LIMIT 1
           ) AS sampleTrackId
    FROM follows f
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json(rows.map(r => ({
      artist: r.artist,
      albumCover: r.albumCover || '/assets/albumart.jpg',
      sampleTrackId: r.sampleTrackId || null
    })));
  });
});

// ======================
// [API] 앨범 목록 (트랙 기반 그룹핑)
// ======================
app.get('/api/users/:userId/albums', (req, res) => {
  const sql = `
    SELECT 
      COALESCE(NULLIF(t.album, ''), t.title, 'Unknown Album') AS albumName,
      t.artist AS artist,
      t.album_cover AS albumCover,
      MAX(t.id) AS sampleTrackId,
      MAX(t.play_count) AS playCount
    FROM tracks t
    GROUP BY albumName, t.artist
    ORDER BY sampleTrackId DESC
    LIMIT 50
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json(rows.map(r => ({
      album: r.albumName || 'Unknown Album',
      artist: r.artist,
      albumCover: r.albumCover || '/assets/albumart.jpg',
      sampleTrackId: r.sampleTrackId
    })));
  });
});


// ======================
// [API] 현재 트랙 좋아요 여부
// ======================
app.get('/api/likes/check', (req, res) => {
  const { userId, trackId } = req.query;

  db.get(`
        SELECT id FROM likes WHERE user_id = ? AND track_id = ?
    `, [userId, trackId], (err, row) => {

    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json({ liked: !!row });
  });
});


// ======================
// [API] 플레이리스트 생성
// ======================
app.post('/api/playlists', (req, res) => {
  const { userId, title } = req.body;

  if (!userId || !title) return res.status(400).json({ message: '정보 누락' });

  const sql = `
      INSERT INTO playlists (user_id, title) VALUES (?, ?)
  `;

  db.run(sql, [userId, title], function(err) {
    if (err) return res.status(500).json({ message: 'DB Error' });

    res.json({ id: this.lastID, title, message: 'Playlist created' });
  });
});

// ======================
// [API] 플레이리스트 삭제
// ======================
app.delete('/api/playlists/:id', (req, res) => {
  const playlistId = req.params.id;

  db.serialize(() => {
    db.run(`DELETE FROM playlist_tracks WHERE playlist_id = ?`, [playlistId], (err) => {
      if (err) return res.status(500).json({ message: '플레이리스트 트랙 삭제 실패' });
    });

    db.run(`DELETE FROM playlists WHERE id = ?`, [playlistId], function(err) {
      if (err) return res.status(500).json({ message: '플레이리스트 삭제 실패' });
      if (this.changes === 0) return res.status(404).json({ message: '플레이리스트를 찾을 수 없습니다.' });
      res.json({ message: 'Playlist deleted' });
    });
  });
});


// ======================
// [API] 유저 플레이리스트 조회
// ======================
app.get('/api/users/:userId/playlists', (req, res) => {
  const sql = `
      SELECT 
        p.*,
        (
          SELECT t.album_cover
          FROM playlist_tracks pt
          JOIN tracks t ON t.id = pt.track_id
          WHERE pt.playlist_id = p.id
          ORDER BY pt.added_at DESC, pt.id DESC
          LIMIT 1
        ) AS cover
      FROM playlists p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
  `;

  db.all(sql, [req.params.userId], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json(rows);
  });
});


// ======================
// [API] 플레이리스트 상세
// ======================
app.get('/api/playlists/:id', (req, res) => {
  const playlistId = req.params.id;

  db.get(`
        SELECT 
          p.*,
          (
            SELECT t.album_cover
            FROM playlist_tracks pt
            JOIN tracks t ON t.id = pt.track_id
            WHERE pt.playlist_id = p.id
            ORDER BY pt.added_at DESC, pt.id DESC
            LIMIT 1
          ) AS cover
        FROM playlists p
        WHERE p.id = ?
    `, [playlistId], (err, playlist) => {

    if (err || !playlist) return res.status(404).json({ message: 'Playlist not found' });

  const trackSql = `
      SELECT t.*, t.play_count AS playCount, pt.added_at
      FROM tracks t
      JOIN playlist_tracks pt ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
      ORDER BY pt.order_num ASC, pt.added_at ASC
    `;

    db.all(trackSql, [playlistId], (err2, tracks) => {
      if (err2) return res.status(500).json({ message: 'DB Error' });

      const formattedTracks = tracks.map(row => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album || "Unknown Album",
        audioSrc: row.filename,
        albumCover: row.album_cover,
        playCount: row.play_count,
        addedAt: row.added_at
      }));

      let latestCover = null;
      if (formattedTracks.length) {
        // addedAt을 기준으로 최신 추가 곡 커버 우선
        const sorted = [...formattedTracks].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        latestCover = sorted[0].albumCover;
      }

      res.json({ ...playlist, cover: latestCover, tracks: formattedTracks });
    });
  });
});


// ======================
// [API] 플레이리스트에 곡 추가
// ======================
app.post('/api/playlists/:id/tracks', (req, res) => {
  const playlistId = req.params.id;
  const { trackId } = req.body;

  db.get(`
        SELECT id FROM playlist_tracks
        WHERE playlist_id = ? AND track_id = ?
    `, [playlistId, trackId], (err, row) => {

    if (row) return res.status(409).json({ message: 'Already in playlist' });

    const sql = `
        INSERT INTO playlist_tracks (playlist_id, track_id)
        VALUES (?, ?)
    `;

    db.run(sql, [playlistId, trackId], (err2) => {
      if (err2) return res.status(500).json({ message: 'DB Error' });
      res.json({ message: 'Track added' });
    });
  });
});


// ======================
// [API] 플레이리스트에서 곡 삭제
// ======================
app.delete('/api/playlists/:pid/tracks/:tid', (req, res) => {
  const { pid, tid } = req.params;

  db.run(`
        DELETE FROM playlist_tracks
        WHERE playlist_id = ? AND track_id = ?
    `, [pid, tid], (err) => {

    if (err) return res.status(500).json({ message: 'DB Error' });
    res.json({ message: 'Deleted' });
  });
});


// ======================
// 기본 index.html 라우팅
// ======================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/public/html/home.html'));
});


// ======================
// Server Start
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
