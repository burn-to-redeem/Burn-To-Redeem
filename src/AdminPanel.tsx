import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Flame,
  LogOut,
  Save,
  Settings2,
  SlidersHorizontal,
  ShieldCheck,
  Trash2,
  WandSparkles
} from 'lucide-react';

type ConfigResponse = {
  ok: boolean;
  config?: Record<string, string>;
  editableKeys?: string[];
  updatedAt?: string | null;
  persistence?: {
    backend?: string;
    durable?: boolean;
    path?: string;
  };
  note?: string;
  error?: string;
};

type ToggleConfig = {
  key: string;
  label: string;
  description: string;
};

const UI_VISIBILITY_TOGGLES: ToggleConfig[] = [
  {
    key: 'WEBSITE_SHOW_HERO_PANEL',
    label: 'Hero Status Panel',
    description: 'Show protocol status and wallet metric cards in the hero area.'
  },
  {
    key: 'WEBSITE_SHOW_ENTRY_BANNER',
    label: 'Entry Banner',
    description: 'Show the campaign banner section below the hero.'
  },
  {
    key: 'WEBSITE_SHOW_FOOTER',
    label: 'Footer',
    description: 'Show or hide the global footer links.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_NFTS',
    label: 'NFTS TO BURN',
    description: 'Toggle NFTs-to-burn page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_REWARDS',
    label: 'REDEEMABLE REWARDS',
    description: 'Toggle redeemable rewards page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_B2R',
    label: 'B2R',
    description: 'Toggle B2R overview page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_BONFIRE',
    label: 'BONFIRE',
    description: 'Toggle Bonfire page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_FORGE',
    label: 'BURN TO FORGE',
    description: 'Toggle Burn to Forge page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_BURNCHAMBER',
    label: 'BURN CHAMBER',
    description: 'Toggle Burn Chamber page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_NEWWORLD',
    label: 'NEW WORLD ORDER',
    description: 'Toggle New World Order page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_TIPSTARTER',
    label: 'TIP YOUR FIRE STARTER',
    description: 'Toggle tip/points page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_MONOCHROME',
    label: 'MONOCHROME',
    description: 'Toggle Monochrome page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_DESTINY',
    label: 'DESTINY',
    description: 'Toggle Destiny page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_KEK',
    label: 'KEK',
    description: 'Toggle KEK page visibility.'
  },
  {
    key: 'WEBSITE_SHOW_TAB_LEADERBOARD',
    label: 'LEADERBOARD',
    description: 'Toggle leaderboard page visibility.'
  }
];

const TOGGLE_KEY_SET = new Set(UI_VISIBILITY_TOGGLES.map((entry) => entry.key));

function isToggleEnabled(value: string | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return true;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

function toggleString(enabled: boolean) {
  return enabled ? '1' : '0';
}

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'runtime' | 'website'>('runtime');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editableKeys, setEditableKeys] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [persistenceNote, setPersistenceNote] = useState('');

  const orderedKeys = useMemo(() => {
    if (editableKeys.length > 0) return editableKeys;
    return Object.keys(config).sort((a, b) => a.localeCompare(b));
  }, [config, editableKeys]);

  const runtimeKeys = useMemo(
    () => orderedKeys.filter((key) => !key.startsWith('WEBSITE_')),
    [orderedKeys]
  );

  const websiteKeys = useMemo(
    () => orderedKeys.filter((key) => key.startsWith('WEBSITE_') && !TOGGLE_KEY_SET.has(key)),
    [orderedKeys]
  );

  const visibleKeys = activeTab === 'website' ? websiteKeys : runtimeKeys;

  const activeToggleCount = useMemo(
    () => UI_VISIBILITY_TOGGLES.filter((entry) => isToggleEnabled(config[entry.key])).length,
    [config]
  );

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
    setPersistenceNote(String(body.note || '').trim());
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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
      setPersistenceNote(String(body.note || '').trim());
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
      setPersistenceNote(String(body.note || '').trim());
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

  function updateToggle(key: string, enabled: boolean) {
    setConfig((prev) => ({
      ...prev,
      [key]: toggleString(enabled)
    }));
  }

  function setAllToggles(enabled: boolean) {
    setConfig((prev) => {
      const next = { ...prev };
      for (const item of UI_VISIBILITY_TOGGLES) {
        next[item.key] = toggleString(enabled);
      }
      return next;
    });
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden text-neutral-100">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.12)_0%,transparent_45%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_72%,rgba(34,211,238,0.09)_0%,transparent_45%)]" />
          <div className="scanline" />
        </div>

        <main className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl glass-panel rounded-3xl p-7 sm:p-9">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-white text-black rounded-sm flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-white/60">Backend Access</div>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight uppercase">Protocol Admin</h1>
            <p className="mt-3 text-sm text-white/72">
              Sign in to control runtime config, website copy, and visibility toggles without redeploying code.
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4 rounded-2xl border border-white/15 bg-black/35 p-5">
              <label className="block text-sm">
                <span className="mb-1 block text-white/70 font-mono uppercase tracking-[0.14em] text-[11px]">Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-300/60"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={isBusy}
                className="w-full rounded-xl bg-white px-4 py-3 font-display font-bold uppercase tracking-[0.08em] text-black disabled:opacity-50"
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
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans selection:bg-white selection:text-black relative overflow-hidden text-neutral-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(255,255,255,0.12)_0%,transparent_48%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_86%_72%,rgba(34,211,238,0.09)_0%,transparent_45%)]" />
        <div className="scanline" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        <section className="glass-panel rounded-3xl p-5 sm:p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-200">
                <Flame className="h-3.5 w-3.5" />
                Burn to Redeem Backend
              </div>
              <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight uppercase">
                Admin Command Center
              </h1>
              <p className="mt-3 text-sm text-white/72 max-w-3xl">
                Control chain runtime settings, website copy, and visibility toggles. Save changes to push updates live.
              </p>
            </div>

            <button
              onClick={handleLogout}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/35 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-white/80 hover:text-white disabled:opacity-45"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('runtime')}
              className={`rounded-lg border px-4 py-2 text-[11px] font-mono uppercase tracking-[0.14em] ${
                activeTab === 'runtime'
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 bg-black/35 text-white/75 hover:text-white'
              }`}
            >
              Runtime Settings
            </button>
            <button
              onClick={() => setActiveTab('website')}
              className={`rounded-lg border px-4 py-2 text-[11px] font-mono uppercase tracking-[0.14em] ${
                activeTab === 'website'
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 bg-black/35 text-white/75 hover:text-white'
              }`}
            >
              Website Builder
            </button>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/45">
              {activeTab === 'website'
                ? 'Edit copy + visibility controls for frontend UI.'
                : 'Edit chain, gate, reward, gas and runtime behavior.'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isBusy ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={handleClearOverrides}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white/85 hover:text-white disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear overrides
            </button>
            {updatedAt ? (
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/50">
                Last update: {new Date(updatedAt).toLocaleString()}
              </span>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/45">
                No runtime overrides saved yet.
              </span>
            )}
          </div>

          {persistenceNote ? (
            <div className="mt-5 rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-xs text-white/65">
              {persistenceNote}
            </div>
          ) : null}
        </section>

        {activeTab === 'website' ? (
          <section className="mt-6 glass-panel rounded-3xl p-5 sm:p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/50">UI Visibility Toggles</div>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-black uppercase tracking-tight">Show / Hide Website Blocks</h2>
                <p className="mt-2 max-w-3xl text-sm text-white/70">
                  Toggle entire tabs and key hero/footer blocks instantly.
                </p>
              </div>
              <div className="rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-right">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45">Visible Items</div>
                <div className="mt-1 font-display text-3xl font-black">
                  {activeToggleCount}/{UI_VISIBILITY_TOGGLES.length}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAllToggles(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/40 bg-emerald-300/15 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-300/25"
              >
                <Check className="h-3.5 w-3.5" />
                Show All
              </button>
              <button
                onClick={() => setAllToggles(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.14em] text-red-200 hover:bg-red-500/20"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hide All
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {UI_VISIBILITY_TOGGLES.map((toggle) => {
                const enabled = isToggleEnabled(config[toggle.key]);
                return (
                  <div
                    key={toggle.key}
                    className="rounded-2xl border border-white/12 bg-black/35 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-display text-lg font-bold uppercase tracking-tight">{toggle.label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-white/60">{toggle.description}</p>
                      </div>
                      <button
                        onClick={() => updateToggle(toggle.key, !enabled)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${
                          enabled
                            ? 'border-emerald-300/45 bg-emerald-300/20 text-emerald-100'
                            : 'border-white/25 bg-black/40 text-white/65'
                        }`}
                      >
                        {enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {enabled ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6 glass-panel rounded-3xl p-5 sm:p-6 md:p-7">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-white/50">
            {activeTab === 'website' ? <WandSparkles className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
            {activeTab === 'website' ? 'Website Copy + Layout Fields' : 'Runtime Configuration Fields'}
          </div>

          {visibleKeys.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {visibleKeys.map((key) => {
                const value = config[key] ?? '';
                const isLongField =
                  key.includes('_IDS') ||
                  key.endsWith('_SUBTITLE') ||
                  key.endsWith('_COLLECTIONS') ||
                  key.endsWith('_URLS');

                return (
                  <label key={key} className="block text-sm rounded-xl border border-white/10 bg-black/30 p-3">
                    <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-white/65">{key}</span>
                    {isLongField ? (
                      <textarea
                        value={value}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            [key]: event.target.value
                          }))
                        }
                        className="min-h-24 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 font-mono text-xs outline-none focus:border-cyan-300/60"
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
                        className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 font-mono text-xs outline-none focus:border-cyan-300/60"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/12 bg-black/30 px-4 py-3 text-sm text-white/60">
              No editable fields in this tab.
            </div>
          )}
        </section>

        <section className="mt-6 glass-panel rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.16em] text-white/50">
            <SlidersHorizontal className="h-4 w-4" />
            Quick Backend Actions
          </div>
          <div className="mt-3 text-sm text-white/70">
            Save to publish changes, then refresh the frontend to confirm updates. Toggle states and copy values are all persisted as runtime overrides.
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}
        {notice ? (
          <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-200">{notice}</div>
        ) : null}
      </main>
    </div>
  );
}
