require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

app.use(express.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

async function loadData() {
  if (supabase) {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('timestamp', { ascending: false });
    if (error) {
      console.error('Supabase load error:', error.message);
      return [];
    }
    return data || [];
  }
  return [];
}

async function clearAll() {
  if (supabase) {
    const { error } = await supabase.from('locations').delete().neq('id', 0);
    if (error) console.error('Supabase clear error:', error.message);
  }
}

// Get IP geolocation. Uses ipwho.is (supports IPv4 and IPv6).
function getIpLocation(ip) {
  return new Promise((resolve) => {
    if (!ip) return resolve(null);

    const url = `https://ipwho.is/${ip}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          if (r.success) {
            resolve({
              country: r.country,
              countryCode: r.country_code,
              region: r.region,
              city: r.city,
              lat: r.latitude,
              lng: r.longitude,
              timezone: r.timezone && r.timezone.id,
              isp: r.connection && (r.connection.isp || r.connection.org)
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function extractClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  return ip.trim();
}

// Track location
app.post('/api/track', async (req, res) => {
  try {
    const { page, browserLat, browserLng } = req.body;
    let ip = extractClientIp(req);

    const ipLocation = await getIpLocation(ip);

    const record = {
      ip: ip,
      latitude: browserLat || (ipLocation ? ipLocation.lat : null),
      longitude: browserLng || (ipLocation ? ipLocation.lng : null),
      city: ipLocation ? ipLocation.city : null,
      region: ipLocation ? ipLocation.region : null,
      country: ipLocation ? ipLocation.country : null,
      countryCode: ipLocation ? ipLocation.countryCode : null,
      timezone: ipLocation ? ipLocation.timezone : null,
      isp: ipLocation ? ipLocation.isp : null,
      page: page,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent']
    };

    if (supabase) {
      const { error } = await supabase.from('locations').insert(record);
      if (error) console.error('Supabase insert error:', error.message);
    }

    res.json({ success: true, location: ipLocation });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all data
app.get('/api/locations', async (req, res) => {
  try {
    res.json(await loadData());
  } catch (e) {
    res.status(500).json([]);
  }
});

// Clear data
app.delete('/api/locations', async (req, res) => {
  try {
    await clearAll();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = app;
