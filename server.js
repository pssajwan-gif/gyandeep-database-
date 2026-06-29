const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const db = new sqlite3.Database('./gyandeep.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS upanyas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Pankaj Singh Sajwan',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upanyas_id INTEGER,
    chapter_no TEXT,
    title TEXT,
    content TEXT,
    bhasha TEXT,
    ai_uploaded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(upanyas_id) REFERENCES upanyas(id)
  )`);
});

app.get('/api/upanyas', (req, res) => {
  db.all("SELECT * FROM upanyas ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/upanyas', (req, res) => {
  const { title, description } = req.body;
  db.run("INSERT INTO upanyas (title, description) VALUES (?,?)", [title, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title, description });
  });
});

app.get('/api/episodes/:upanyas_id', (req, res) => {
  db.all("SELECT * FROM episodes WHERE upanyas_id =? ORDER BY id DESC", [req.params.upanyas_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/episodes', async (req, res) => {
  const { upanyas_id, chapter_no, title, content, bhasha, upload_to_ai } = req.body;
  db.run("INSERT INTO episodes (upanyas_id, chapter_no, title, content, bhasha) VALUES (?,?,?,?,?)",
    [upanyas_id, chapter_no, title, content, bhasha],
    async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const episodeId = this.lastID;
      let aiStatus = "Not uploaded";
      if (upload_to_ai && process.env.ANYTHING_LLM_URL && process.env.API_KEY) {
        try {
          const fileContent = `Upanyas: ${title}\nEpisode: ${chapter_no}\nBhasha: ${bhasha}\n\n${content}`;
          await axios.post(`${process.env.ANYTHING_LLM_URL}/api/v1/document/raw-text`, {
            textContent: fileContent,
            metadata: { title: `${title}_${chapter_no}.txt`, workspaceSlug: process.env.WORKSPACE_SLUG }
          }, { headers: { 'Authorization': `Bearer ${process.env.API_KEY}` } });
          db.run("UPDATE episodes SET ai_uploaded = 1 WHERE id =?", [episodeId]);
          aiStatus = "Uploaded to AI";
        } catch (aiError) {
          aiStatus = "AI Upload Failed";
        }
      }
      res.json({ id: episodeId, aiStatus });
    });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`GyanDeep Database Server चालू है Port ${PORT} पर`);
});
