import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

let db: Database

export async function initDB() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database,
  })

  await db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      thumbnail TEXT,
      duration TEXT,
      added_by TEXT,
      author TEXT,
      is_stream BOOLEAN,
      source_name TEXT,
      identifier TEXT,
      uri TEXT,
      order_index INTEGER,
      FOREIGN KEY(playlist_id) REFERENCES playlists(id)
    );
  `)

  // Migration for existing tables (simple check)
  try {
    await db.exec('ALTER TABLE songs ADD COLUMN author TEXT')
    await db.exec('ALTER TABLE songs ADD COLUMN is_stream BOOLEAN')
    await db.exec('ALTER TABLE songs ADD COLUMN source_name TEXT')
    await db.exec('ALTER TABLE songs ADD COLUMN identifier TEXT')
    await db.exec('ALTER TABLE songs ADD COLUMN uri TEXT')
    console.log('Migrated songs table with new columns')
  } catch (e) {
    // Columns likely exist, ignore
  }

  try {
    await db.exec('ALTER TABLE songs ADD COLUMN order_index INTEGER')
    await db.exec('UPDATE songs SET order_index = id WHERE order_index IS NULL')
    console.log('Migrated songs table with order_index')
  } catch (e) {
    // Column likely exists
  }

  console.log('Database initialized')
  return db
}

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized!')
  }
  return db
}

export const deleteSong = async (id: number) => {
  const db = getDB()
  await db.run('DELETE FROM songs WHERE id = ?', id)
}
