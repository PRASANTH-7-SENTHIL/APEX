module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};

    const name = String(body.name || '').trim().slice(0, 200);
    const phone = String(body.phone || '').trim().slice(0, 50);
    const email = String(body.email || '').trim().slice(0, 200);
    const company = String(body.company || body.companyName || '').trim().slice(0, 200);
    const projectType = String(body.projectType || '').trim().slice(0, 100);
    const projectLocation = String(body.projectLocation || '').trim().slice(0, 300);
    const budget = String(body.estimatedBudget || body.estimationBudget || '').trim().slice(0, 100);

    // Validation
    const missing = [];
    if (!name) missing.push('Name');
    if (!phone) missing.push('Phone Number');
    if (!email) missing.push('Mail ID');
    if (!projectType) missing.push('Project Type');
    if (!projectLocation) missing.push('Project Location');
    if (!budget) missing.push('Estimation Budget');

    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: 'Missing required fields: ' + missing.join(', ') });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    const payload = {
      name,
      phone,
      email,
      company,
      projectType,
      projectLocation,
      estimationBudget: budget
    };

    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    let submissionId = 'APX-' + String(Date.now()).slice(-4);

    if (webhookUrl) {
      try {
        const sheetsRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        const sheetsData = await sheetsRes.json();
        if (sheetsData.status === 'success' && sheetsData.submissionId) {
          submissionId = sheetsData.submissionId;
        }
      } catch (sheetErr) {
        console.error('Google Sheets forwarding error:', sheetErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      submissionId: submissionId,
      message: 'Your enquiry has been successfully submitted to APEX INFRASTRUCTURE.'
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error processing enquiry.'
    });
  }
};
