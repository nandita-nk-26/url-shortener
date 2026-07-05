const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database setup
const dbPath = process.env.DATABASE_PATH || './urls.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        // Create table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                short_code TEXT UNIQUE NOT NULL,
                long_url TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                clicks INTEGER DEFAULT 0
            )
        `);
        console.log('Table ready');
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/features', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'features.html'));
});

// API: Create short URL
app.post('/api/shorten', (req, res) => {
    const { longUrl, customCode } = req.body;
    
    if (!longUrl) {
        return res.status(400).json({ error: 'Long URL is required' });
    }

    const shortCode = customCode || generateShortCode();
    
    // Check if custom code already exists
    db.get('SELECT * FROM urls WHERE short_code = ?', [shortCode], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (row) {
            return res.status(400).json({ error: 'Short code already exists' });
        }

        // Insert new URL
        db.run('INSERT INTO urls (short_code, long_url) VALUES (?, ?)', 
            [shortCode, longUrl], 
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create short URL' });
                }
                res.json({
                    success: true,
                    shortCode: shortCode,
                    shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
                    longUrl: longUrl
                });
            }
        );
    });
});

// API: Get stats
app.get('/api/stats/:code', (req, res) => {
    const code = req.params.code;
    
    db.get('SELECT * FROM urls WHERE short_code = ?', [code], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Short URL not found' });
        }
        res.json({
            shortCode: row.short_code,
            longUrl: row.long_url,
            clicks: row.clicks || 0,
            createdAt: row.created_at
        });
    });
});

// Redirect: Short URL
app.get('/:code', (req, res) => {
    const code = req.params.code;
    
    // Skip if it's a static file request
    if (code.includes('.')) {
        return res.status(404).send('Not found');
    }

    db.get('SELECT long_url FROM urls WHERE short_code = ?', [code], (err, row) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        if (!row) {
            return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
        }
        
        // Increment click count
        db.run('UPDATE urls SET clicks = clicks + 1 WHERE short_code = ?', [code]);
        
        // Redirect to the long URL
        res.redirect(row.long_url);
    });
});

// Generate random short code
function generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Visit: http://localhost:${PORT}`);
});