import { clearAdminSession } from '../_lib/adminAuth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  clearAdminSession(res);
  return res.status(200).json({ ok: true, message: 'Admin session cleared.' });
}
