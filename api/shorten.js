const { nanoid } = require('nanoid');
const { query } = require('../database');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { url, customCode } = req.body;
    
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    
    let code = customCode;
    
    if (!code) {
      // Generate unique code
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 10) {
        code = nanoid(6);
        const existing = await query('SELECT code FROM urls WHERE code = $1', [code]);
        exists = existing.rows.length > 0;
        attempts++;
      }
    } else {
      const existing = await query('SELECT code FROM urls WHERE code = $1', [code]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Custom code already taken' });
      }
    }
    
    await query(
      'INSERT INTO urls (code, long_url) VALUES ($1, $2)',
      [code, url]
    );
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    res.json({
      shortUrl: `${baseUrl}/${code}`,
      code: code,
      longUrl: url
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};