import { useEffect, useMemo, useState } from 'react';

type ConfigResponse = {
  ok: boolean;
  config?: Record<string, string>;
  editableKeys?: string[];
  updatedAt?: string | null;
  error?: string;
};

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editableKeys, setEditableKeys] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const orderedKeys = useMemo(() => {
    if (editableKeys.length > 0) return editableKeys;
    return Object.keys(config).sort((a, b) => a.localeCompare(b));
  }, [config, editableKeys]);

  async function fetchConfig() {
    const response = await fetch('/api/admin/config', {
      method: 'GET',
      credentials: 'include'
    });

    const body = (await response.json().catch(() => ({}))) as ConfigResponse;
    if (!response.ok || !body.ok) {
      throw new Error(body.error || 'Failed to load admin config.');
    }

    setConfig(body.config || {});
    setEditableKeys(body.editableKeys || []);
    setUpdatedAt(body.updatedAt || null);
    setIsAuthenticated(true);
  }

  useEffect(() => {
    (async () => {
      try {
        await fetchConfig();
      } catch {
        setIsAuthenticated(false);
      }
    })();
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsBusy(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const body = (await response.json().catch(() => ({}))) as ConfigResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Admin login failed.');
      }

      setPassword('');
      setNotice('Admin login successful.');
      await fetchConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Admin login failed.';
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave() {
    setError('');
    setNotice('');
    setIsBusy(true);

    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const body = (await response.json().catch(() => ({}))) as ConfigResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Failed to save config.');
      }

      setConfig(body.config || {});
      setEditableKeys(body.editableKeys || editableKeys);
      setUpdatedAt(body.updatedAt || null);
      setNotice('Config saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save config.';
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleClearOverrides() {
    setError('');
    setNotice('');
    setIsBusy(true);

    try {
      const response = await fetch('/api/admin/config', {
        method: 'DELETE',
        credentials: 'include'
      });

      const body = (await response.json().catch(() => ({}))) as ConfigResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Failed to clear overrides.');
      }

      setConfig(body.config || {});
      setEditableKeys(body.editableKeys || editableKeys);
      setUpdatedAt(body.updatedAt || null);
      setNotice('Overrides cleared.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear overrides.';
      setError(message);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogout() {
    setError('');
    setNotice('');
    setIsBusy(true);

    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setNotice('Logged out.');
    } finally {
      setIsBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="mx-auto max-w-md px-5 py-12">
          <h1 className="text-3xl font-bold tracking-tight">Admin Login</h1>
          <p className="mt-2 text-sm text-neutral-400">Enter admin password to manage runtime reward and gate settings.</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-300">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isBusy}
              className="w-full rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black disabled:opacity-50"
            >
              {isBusy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">{notice}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Update runtime reward and token-gate config without code changes.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              disabled={isBusy}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isBusy}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {isBusy ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={handleClearOverrides}
              disabled={isBusy}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              Clear overrides
            </button>
            {updatedAt ? (
              <span className="text-xs text-neutral-400">Last update: {new Date(updatedAt).toLocaleString()}</span>
            ) : (
              <span className="text-xs text-neutral-500">No runtime overrides saved yet.</span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {orderedKeys.map((key) => {
              const value = config[key] ?? '';
              const isLongField = key.includes('_IDS');

              return (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-mono text-xs text-neutral-300">{key}</span>
                  {isLongField ? (
                    <textarea
                      value={value}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          [key]: event.target.value
                        }))
                      }
                      className="min-h-20 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          [key]: event.target.value
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">{notice}</div>
        ) : null}
      </div>
    </div>
  );
}
