import {
  assertAdminConfigured,
  createAdminSession,
  readLoginPayload,
  verifyAdminCredentials
} from '../_lib/adminAuth.js';
import { getEditableConfig } from '../_lib/runtimeOverrides.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    assertAdminConfigured();

    const { password } = readLoginPayload(req);
    if (!verifyAdminCredentials(password)) {
      return res.status(401).json({ ok: false, error: 'Invalid admin credentials.' });
    }

    createAdminSession(res, 'admin');
    const { config, updatedAt } = await getEditableConfig();

    return res.status(200).json({
      ok: true,
      message: 'Admin login successful.',
      config,
      updatedAt,
      note: 'Overrides are stored in runtime storage and may reset when serverless instances restart.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
