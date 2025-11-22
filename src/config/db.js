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

// Users 테이블 생성
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

// [추가됨] Tracks 테이블 생성
db.run(
  `CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    filename TEXT NOT NULL,
    album_cover TEXT DEFAULT '../assets/albumart.jpg',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
);

module.exports = db;