const express = require('express');
const { nanoid } = require('nanoid');
const { initDb } = require('./database');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let db;

async function generateUniqueCode() {
  let code;
  let exists = true;
  
  while (exists) {
    code = nanoid(6);
    const existing = await db.get('SELECT code FROM urls WHERE code = ?', code);
    exists = existing !== undefined;
  }
  
  return code;
}

app.post('/api/shorten', async (req, res) => {
  try {
    const { url, customCode } = req.body;
    
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    let code = customCode;
    
    if (!code) {
      code = await generateUniqueCode();
    } else {
      const existing = await db.get('SELECT code FROM urls WHERE code = ?', code);
      if (existing) {
        return res.status(400).json({ error: 'Custom code already taken' });
      }
    }
    
    await db.run(
      'INSERT INTO urls (code, long_url) VALUES (?, ?)',
      [code, url]
    );
    
    res.json({
      shortUrl: `http://localhost:${PORT}/${code}`,
      code: code,
      longUrl: url
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const urlRecord = await db.get(
      'SELECT long_url FROM urls WHERE code = ?',
      code
    );
    
    if (!urlRecord) {
      return res.status(404).send('Short link not found');
    }
    
    db.run('UPDATE urls SET clicks = clicks + 1 WHERE code = ?', code);
    
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referer') || 'direct';
    
    db.run(
      'INSERT INTO clicks (code, ip_address, user_agent, referrer) VALUES (?, ?, ?, ?)',
      [code, ip, userAgent, referrer]
    ).catch(err => console.error('Click logging error:', err));
    
    res.redirect(302, urlRecord.long_url);
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/api/stats/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const urlInfo = await db.get(
      'SELECT long_url, clicks, created_at FROM urls WHERE code = ?',
      code
    );
    
    if (!urlInfo) {
      return res.status(404).json({ error: 'Code not found' });
    }
    
    const referrers = await db.all(
      `SELECT 
         CASE 
           WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
           ELSE referrer 
         END as source,
         COUNT(*) as count
       FROM clicks 
       WHERE code = ? 
       GROUP BY source
       ORDER BY count DESC
       LIMIT 5`,
      code
    );
    
    const hourly = await db.all(
      `SELECT 
         strftime('%H', clicked_at) as hour,
         COUNT(*) as count
       FROM clicks 
       WHERE code = ? 
         AND clicked_at > datetime('now', '-1 day')
       GROUP BY hour
       ORDER BY hour`,
      code
    );
    
    res.json({
      code,
      longUrl: urlInfo.long_url,
      totalClicks: urlInfo.clicks,
      created_at: urlInfo.created_at,
      referrers,
      hourly
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== NEW FEATURE: VIEW ALL LINKS ==========
app.get('/all-links', async (req, res) => {
  try {
    const links = await db.all('SELECT code, long_url, clicks FROM urls ORDER BY clicks DESC');
    
    let html = '<h1>All Your Short Links</h1><table border="1" cellpadding="10"><tr><th>Code</th><th>URL</th><th>Clicks</th></tr>';
    
    for (let link of links) {
      html += `<tr>
        <td><a href="http://localhost:3000/${link.code}" target="_blank">${link.code}</a></td>
        <td>${link.long_url.substring(0, 60)}${link.long_url.length > 60 ? '...' : ''}</td>
        <td>${link.clicks}</td>
      </tr>`;
    }
    
    html += '</table><br><a href="/">← Back to Dashboard</a>';
    res.send(html);
    
  } catch (error) {
    res.send('Error loading links');
  }
});
// ========== END OF NEW FEATURE ==========

async function start() {
  db = await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📝 Create short links at http://localhost:${PORT}`);
    console.log(`📊 View all links at http://localhost:${PORT}/all-links`);
  });
}

start();