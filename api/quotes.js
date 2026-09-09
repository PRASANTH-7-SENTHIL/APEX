module.exports = (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.status(200).json({ message: 'Quotes are forwarded to Google Sheets.', count: 0, enquiries: [] });
};
