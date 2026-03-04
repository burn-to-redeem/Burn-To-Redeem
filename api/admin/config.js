import { parseJsonBody } from '../_lib/claimUtils.js';
import { requireAdminSession } from '../_lib/adminAuth.js';
import {
  EDITABLE_OVERRIDE_KEYS,
  clearEditableConfig,
  getEditableConfig,
  updateEditableConfig
} from '../_lib/runtimeOverrides.js';

export default async function handler(req, res) {
  const protocol = req.headers?.['x-forwarded-proto'] || 'https';
  const host = req.headers?.host || 'localhost';
  const url = new URL(req.url || '/api/admin/config', `${protocol}://${host}`);
  const internalMode = url.searchParams.get('internal') === '1';
  const internalSecret = (process.env.RUNTIME_CONFIG_INTERNAL_SECRET || '').trim();

  if (!internalMode) {
    const session = requireAdminSession(req, res);
    if (!session) return;
  } else {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed in internal mode.' });
    }
    const providedSecret = String(req.headers?.['x-runtime-config-secret'] || '').trim();
    if (!internalSecret || providedSecret !== internalSecret) {
      return res.status(401).json({ ok: false, error: 'Invalid internal config secret.' });
    }
  }

  try {
    if (req.method === 'GET') {
      const { config, overrides, updatedAt } = await getEditableConfig();
      return res.status(200).json({
        ok: true,
        config,
        overrides,
        updatedAt,
        editableKeys: EDITABLE_OVERRIDE_KEYS,
        note: 'Runtime overrides may reset when serverless instances restart.'
      });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = parseJsonBody(req);
      const patch = body?.config && typeof body.config === 'object' ? body.config : body;
      const { config, overrides, updatedAt } = await updateEditableConfig(patch || {});
      return res.status(200).json({
        ok: true,
        message: 'Config updated.',
        config,
        overrides,
        updatedAt,
        editableKeys: EDITABLE_OVERRIDE_KEYS
      });
    }

    if (req.method === 'DELETE') {
      const { config, overrides, updatedAt } = await clearEditableConfig();
      return res.status(200).json({
        ok: true,
        message: 'Overrides cleared.',
        config,
        overrides,
        updatedAt,
        editableKeys: EDITABLE_OVERRIDE_KEYS
      });
    }

    res.setHeader('Allow', 'GET, PUT, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return res.status(500).json({ ok: false, error: message });
  }
}
