require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png') && filePath.includes('frames')) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // frames caching
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// In-memory enquiry store (avoids read-only filesystem errors on Vercel / serverless)
const localEnquiries = [];

// Helper: Generate next unique APX-XXXX submission ID from local store
function generateLocalSubmissionId() {
  let maxNum = 0;
  localEnquiries.forEach(item => {
    const match = String(item.submissionId || '').match(/^APX-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  return 'APX-' + String(nextNum).padStart(4, '0');
}

// Helper: Save enquiry in-memory
function saveEnquiry(data) {
  try {
    localEnquiries.push({ ...data, receivedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error('Error saving enquiry:', e.message);
    return false;
  }
}

// Helper: Forward to Google Sheets via Apps Script Web App URL
async function forwardToGoogleSheets(data) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, unconfigured: true, error: 'Google Sheets webhook URL is not configured' };
  }

  try {
    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      company: data.company || '',
      projectType: data.projectType,
      projectLocation: data.projectLocation,
      estimationBudget: data.estimatedBudget || data.estimationBudget || ''
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(25000) // 25 second timeout
    });

    if (!res.ok) {
      return { success: false, error: `Google Sheets responded with HTTP status ${res.status}` };
    }

    const json = await res.json();
    if (json.status === 'success' && json.submissionId) {
      return { success: true, submissionId: json.submissionId, message: json.message };
    } else {
      return { success: false, error: json.message || 'Google Sheets returned an unsuccessful status' };
    }
  } catch (err) {
    console.error('Google Sheets forward error:', err.message);
    return { success: false, error: err.message };
  }
}

// Validate quote form fields: B) Name, C) Phone, D) Email, F) Project Type, G) Project Location, H) Estimation Budget
function validateQuote(body) {
  const required = [
    { field: 'name', label: 'Name' },
    { field: 'phone', label: 'Phone Number' },
    { field: 'email', label: 'Mail ID' },
    { field: 'projectType', label: 'Project Type' },
    { field: 'projectLocation', label: 'Project Location' }
  ];

  // Estimation budget check
  const budget = body.estimatedBudget || body.estimationBudget;
  if (!budget || String(budget).trim() === '') {
    return { valid: false, error: 'Estimation Budget is required' };
  }

  for (const item of required) {
    if (!body[item.field] || String(body[item.field]).trim() === '') {
      return { valid: false, error: `${item.label} is required` };
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

// POST /api/quote
app.post('/api/quote', async (req, res) => {
  try {
    const validation = validateQuote(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const sanitized = {
      name: String(req.body.name || '').trim().slice(0, 200),
      phone: String(req.body.phone || '').trim().slice(0, 50),
      email: String(req.body.email || '').trim().slice(0, 200),
      company: String(req.body.company || req.body.companyName || '').trim().slice(0, 200),
      projectType: String(req.body.projectType || '').trim().slice(0, 100),
      projectLocation: String(req.body.projectLocation || '').trim().slice(0, 300),
      estimatedBudget: String(req.body.estimatedBudget || req.body.estimationBudget || '').trim().slice(0, 100)
    };

    let submissionId = null;

    // 1. If Google Sheets Webhook is configured, forward to Google Sheets (which creates unique ID in Column A)
    const sheetsResult = await forwardToGoogleSheets(sanitized);

    if (sheetsResult.success && sheetsResult.submissionId) {
      submissionId = sheetsResult.submissionId;
    } else if (sheetsResult.unconfigured) {
      // If webhook not configured yet in .env, generate server-side unique ID APX-XXXX
      submissionId = generateLocalSubmissionId();
      console.log(`[LOCAL ENQUIRY] Generated unique ID: ${submissionId} (Set GOOGLE_SHEETS_WEBHOOK_URL to sync with Google Sheet)`);
    } else {
      console.error('[ENQUIRY ERROR] Failed to record in Google Sheets:', sheetsResult.error);
      return res.status(500).json({
        success: false,
        error: 'Unable to submit your enquiry to Google Sheets right now. Please try again.'
      });
    }

    // Save locally with the unique submissionId
    saveEnquiry({ ...sanitized, submissionId });

    console.log(`[ENQUIRY SUCCESS] ID: ${submissionId} | Name: ${sanitized.name} <${sanitized.email}>`);

    res.json({
      success: true,
      submissionId: submissionId,
      message: 'Your enquiry has been successfully submitted to APEX INFRASTRUCTURE.'
    });

  } catch (err) {
    console.error('POST /api/quote error:', err);
    res.status(500).json({
      success: false,
      error: 'Unable to submit your enquiry right now. Please try again.'
    });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// GET /api/quotes (protected by env-set admin key)
app.get('/api/quotes', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ count: localEnquiries.length, enquiries: localEnquiries });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏗️  APEX INFRASTRUCTURE Server running at http://localhost:${PORT}`);
    console.log(`📁  Frames served from: /frames/frame_000001.png ... frame_000268.png`);
    if (!process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
      console.log(`⚠️   Google Sheets not configured. Set GOOGLE_SHEETS_WEBHOOK_URL in .env to enable.`);
    }
  });
}

module.exports = app;
