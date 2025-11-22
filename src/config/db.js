// src/config/db.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH || './database/users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

db.serialize(() => {
  // 1. Users 테이블
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      nickname TEXT UNIQUE,
      password TEXT,
      profile_image TEXT DEFAULT '../assets/default_profile.jpg'
    )`
  );

  // 2. Tracks 테이블 (play_count 컬럼 추가됨)
  db.run(
    `CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      filename TEXT NOT NULL,
      album_cover TEXT DEFAULT '../assets/albumart.jpg',
      play_count INTEGER DEFAULT 0, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // 3. Play History 테이블 (최근 재생)
  db.run(
    `CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      track_id INTEGER,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(track_id) REFERENCES tracks(id)
    )`
  );

  // 4. Likes 테이블 (좋아요)
  db.run(
    `CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      track_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(track_id) REFERENCES tracks(id),
      UNIQUE(user_id, track_id) -- 복합 유니크 키: 한 유저가 같은 곡을 중복 좋아요 불가
    )`
  );

  // 5. Playlists 테이블
  db.run(
    `CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`
  );

  // 6. Playlist Tracks 테이블 (플레이리스트 내부 곡 목록)
  db.run(
    `CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      track_id INTEGER,
      order_num INTEGER, -- 정렬 순서
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY(track_id) REFERENCES tracks(id)
    )`
  );
});

module.exports = db;