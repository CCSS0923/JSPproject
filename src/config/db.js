const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// DB 폴더 절대 경로: F:\JSP\JSPproject\src\database
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// DB 파일 절대 경로
const dbPath = path.join(dbDir, 'users.db');

// SQLite 연결
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to connect to database:', err.message);
  } else {
    console.log('📀 SQLite Connected:', dbPath);
  }
});

// ----- 테이블 생성 -----
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      nickname TEXT UNIQUE,
      password TEXT,
      profile_image TEXT DEFAULT '../assets/default_profile.jpg'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      filename TEXT NOT NULL,
      album TEXT DEFAULT 'Unknown Album',
      album_cover TEXT DEFAULT '../assets/albumart.jpg',
      play_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      track_id INTEGER,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      track_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, track_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      track_id INTEGER,
      order_num INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      artist TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, artist)
    )
  `);

  // 기존 DB에 album 컬럼이 없을 수 있으므로 보강
  db.all("PRAGMA table_info(tracks)", (err, info) => {
    if (err) {
      console.error('PRAGMA failed:', err.message);
      return;
    }
    const hasAlbum = Array.isArray(info) ? info.some(col => col.name === 'album') : false;
    if (!hasAlbum) {
      db.run("ALTER TABLE tracks ADD COLUMN album TEXT DEFAULT 'Unknown Album'", (alterErr) => {
        if (alterErr) console.error('Failed to add album column:', alterErr.message);
        else console.log('✅ Added album column to tracks table');
      });
    }
  });
});

module.exports = db;
