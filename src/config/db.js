// src/config/db.js (수정됨)

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

db.run(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    nickname TEXT UNIQUE, -- 여기에 UNIQUE 추가
    password TEXT,
    profile_image TEXT DEFAULT '../assets/default_profile.jpg'
  )`
);

module.exports = db;