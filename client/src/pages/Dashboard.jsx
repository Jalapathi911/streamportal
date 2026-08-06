import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';

const TIER_LABEL  = { 'audio': 'Audio', 'hd': 'HD', 'full-hd': 'Full HD', '2k': '2K', '2k+': '2K+' };
const TIER_COLOR  = { 'audio': 'bg-gray-200 text-gray-600', 'hd': 'bg-green-100 text-green-700', 'full-hd': 'bg-blue-100 text-blue-700', '2k': 'bg-orange-100 text-orange-700', '2k+': 'bg-red-100 text-red-700' };
const TIER_PRICE  = { 'audio': 0.99, 'hd': 3.99, 'full-hd': 8.99, '2k': 15.99, '2k+': 35.99 };

function fmtSeconds(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtBytes(bytes) {
  if (!bytes)             return '—';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function toBytes(value, unit) {
  const n = Number(value);
  if (!n || n <= 0) return 0;
  return Math.round(n * (unit === 'GB' ? 1073741824 : 1048576));
}

function fromBytes(bytes) {
  if (!bytes) return { value: '', unit: 'GB' };
  if (bytes >= 1073741824) return { value: String(parseFloat((bytes / 1073741824).toFixed(3))), unit: 'GB' };
  return { value: String(parseFloat((bytes / 1048576).toFixed(3))), unit: 'MB' };
}

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
);

function UsageBar({ bytesUsed, bytesLimit }) {
  if (!bytesLimit) {
    return <span className="text-gray-600 text-sm font-mono">{fmtBytes(bytesUsed)}</span>;
  }
  const pct      = Math.min((bytesUsed / bytesLimit) * 100, 100);
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-[#8B2BE2]';
  const textColor = pct >= 100 ? 'text-red-500' : 'text-gray-600';
  return (
    <div className="space-y-1 w-full">
      <div className="flex items-center gap-1 text-xs font-mono flex-wrap">
        <span className={textColor}>{fmtBytes(bytesUsed)}</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-400">{fmtBytes(bytesLimit)}</span>
        {pct >= 100 && <span className="text-red-500 font-bold text-[10px] tracking-wider">OVER</span>}
      </div>
      <div className="h-1.5 bg-[#e8e0f5] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [rooms,          setRooms]          = useState([]);
  const [roomName,       setRoomName]       = useState('');
  const [limitInput,     setLimitInput]     = useState('');
  const [limitUnitInput, setLimitUnitInput] = useState('GB');
  const [loading,        setLoading]        = useState(false);
  const [toast,          setToast]          = useState('');
  const [limitModal,     setLimitModal]     = useState(null);
  const [modalValue,     setModalValue]     = useState('');
  const [modalUnit,      setModalUnit]      = useState('GB');
  const [usageData,      setUsageData]      = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchRooms();
    fetchUsage();
    const interval = setInterval(() => { fetchRooms(); fetchUsage(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  async function fetchRooms() {
    const res = await apiFetch('/api/rooms', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { navigate('/login'); return; }
    setRooms(await res.json());
  }

  async function fetchUsage() {
    try {
      const res = await apiFetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsageData(await res.json());
    } catch { /* non-critical */ }
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    const res = await apiFetch('/api/rooms', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ name: roomName, bytesLimit: toBytes(limitInput, limitUnitInput) }),
    });
    if (res.ok) { setRoomName(''); setLimitInput(''); fetchRooms(); }
    setLoading(false);
  }

  async function deleteRoom(id) {
    await apiFetch(`/api/rooms/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fetchRooms();
  }

  function copyLink(id) {
    navigator.clipboard.writeText(`${window.location.origin}/room/${id}`);
    showToast('Link copied!');
  }

  function openLimitModal(room) {
    const { value, unit } = fromBytes(room.bytesLimit);
    setLimitModal(room); setModalValue(value); setModalUnit(unit);
  }

  async function saveLimit() {
    if (!limitModal) return;
    const res = await apiFetch(`/api/rooms/${limitModal.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ bytesLimit: toBytes(modalValue, modalUnit) }),
    });
    if (res.ok) { setLimitModal(null); fetchRooms(); showToast('Limit updated'); }
  }

  function logout() { localStorage.removeItem('token'); navigate('/login'); }

  return (
    <div className="min-h-screen bg-[#f8f5ff] flex">

      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#e8e0f5] flex flex-col p-6">
        <div className="flex flex-col mb-10">
          <img src="/holobox911-logo.png" alt="HoloBox911" className="w-36 object-contain mb-1" />
          <p className="text-[#8B2BE2] text-[9px] font-semibold tracking-widest uppercase">Live stream</p>
        </div>

        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#8B2BE2]/10 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B2BE2" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span className="text-[#8B2BE2] text-sm font-semibold">Rooms</span>
          </div>
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-700 text-sm transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Rooms</h1>
          <p className="text-gray-500 text-sm mb-6">Create and manage your live stream rooms</p>

          {/* Agora Free Tier Panel */}
          {usageData && (
            <div className="bg-white border border-[#e8e0f5] rounded-2xl p-5 mb-6 max-w-2xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-900 font-semibold text-sm">Agora Free Tier — {usageData.month}</p>
                  <p className="text-gray-400 text-xs mt-0.5">10,000 min/month free · per participant · resets on server restart</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-900 font-mono text-sm font-semibold">{usageData.totalMinutes.toLocaleString()} <span className="text-gray-400 font-normal">/ 10,000 min</span></p>
                  {usageData.estimatedCostUSD > 0 && (
                    <p className="text-orange-600 text-xs font-semibold">Est. ${usageData.estimatedCostUSD} over free tier</p>
                  )}
                </div>
              </div>

              {/* Free tier progress bar */}
              {(() => {
                const pct = Math.min((usageData.totalMinutes / usageData.freeTierLimit) * 100, 100);
                const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-[#8B2BE2]';
                return (
                  <div className="mb-3">
                    <div className="h-2 bg-[#e8e0f5] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-400 text-xs">{usageData.remainingFree.toLocaleString()} min remaining</span>
                      <span className="text-gray-400 text-xs">{pct.toFixed(1)}% used</span>
                    </div>
                  </div>
                );
              })()}

              {/* Per-tier breakdown */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(usageData.tiers).map(([tier, mins]) => mins > 0 && (
                  <div key={tier} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${TIER_COLOR[tier]}`}>
                    <span>{TIER_LABEL[tier]}</span>
                    <span className="opacity-70">{mins.toFixed(1)} min</span>
                    <span className="opacity-50">· ${((mins / 1000) * TIER_PRICE[tier]).toFixed(3)}</span>
                  </div>
                ))}
                {Object.values(usageData.tiers).every(v => v === 0) && (
                  <span className="text-gray-400 text-xs">No usage recorded yet — start a session to see data.</span>
                )}
              </div>
            </div>
          )}

          {/* Create Room */}
          <div className="bg-white border border-[#e8e0f5] rounded-2xl p-6 mb-8 max-w-2xl shadow-sm">
            <h2 className="text-gray-900 font-semibold mb-4">Create Room</h2>
            <form onSubmit={createRoom} className="space-y-3">
              <div className="flex gap-3">
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Room name…"
                  className="flex-1 bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#8B2BE2] focus:ring-2 focus:ring-[#8B2BE2]/10 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#8B2BE2] hover:bg-[#7B1BD2] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#8B2BE2]/20 whitespace-nowrap"
                >
                  Create
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-gray-500 text-xs shrink-0">Data limit</span>
                <input
                  type="number" min="0" step="any"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="Unlimited"
                  className="w-28 bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-3 py-1.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-[#8B2BE2] transition-all"
                />
                <select
                  value={limitUnitInput}
                  onChange={(e) => setLimitUnitInput(e.target.value)}
                  className="bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-3 py-1.5 text-gray-900 text-sm focus:outline-none focus:border-[#8B2BE2] transition-all"
                >
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
                <span className="text-gray-400 text-xs">Leave blank for unlimited</span>
              </div>
            </form>
          </div>

          {/* Room List */}
          <div className="bg-white border border-[#e8e0f5] rounded-2xl overflow-hidden shadow-sm">
            <div
              className="grid gap-3 px-6 py-3 border-b border-[#e8e0f5] text-gray-400 text-xs uppercase tracking-wider"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr' }}
            >
              <span>Name</span><span>Created</span><span>Link</span><span>Delete</span><span>Resolution / Time</span><span>Usage / Limit</span>
            </div>

            {rooms.length === 0 ? (
              <p className="text-gray-400 text-sm px-6 py-10 text-center">No rooms yet. Create one above.</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="grid gap-3 px-6 py-4 border-b border-[#e8e0f5] last:border-0 items-center hover:bg-[#f5f0ff] transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr' }}
                >
                  <span className="text-gray-900 font-medium truncate">{room.name}</span>
                  <span className="text-gray-500 text-sm">{timeAgo(room.createdAt)}</span>
                  <button
                    onClick={() => copyLink(room.id)}
                    className="text-[#8B2BE2] hover:text-[#7B1BD2] text-sm transition-colors text-left font-medium"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => deleteRoom(room.id)}
                    className="text-red-500 hover:text-red-600 text-sm transition-colors text-left"
                  >
                    Delete
                  </button>

                  {/* Resolution tier + session time */}
                  <div className="flex flex-col gap-1">
                    {room.resolutionTier ? (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold w-fit ${TIER_COLOR[room.resolutionTier]}`}>
                          {TIER_LABEL[room.resolutionTier]}
                          {room.resolutionWidth ? ` ${room.resolutionWidth}×${room.resolutionHeight}` : ''}
                        </span>
                        <span className="text-gray-400 text-xs font-mono">{fmtSeconds(room.sessionSeconds)}</span>
                      </>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <UsageBar bytesUsed={room.bytesUsed} bytesLimit={room.bytesLimit} />
                    </div>
                    <button
                      onClick={() => openLimitModal(room)}
                      title="Edit limit"
                      className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-gray-300 hover:text-[#8B2BE2] hover:bg-[#8B2BE2]/10 transition-colors"
                    >
                      <EditIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Edit limit modal */}
      {limitModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setLimitModal(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm px-4">
            <div className="bg-white border border-[#e8e0f5] rounded-2xl p-6 shadow-2xl shadow-[#8B2BE2]/10">
              <p className="text-gray-900 font-semibold mb-1">Edit Data Limit</p>
              <p className="text-gray-500 text-sm mb-5 truncate">{limitModal.name}</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="number" min="0" step="any"
                  value={modalValue}
                  onChange={(e) => setModalValue(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="flex-1 bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#8B2BE2] focus:ring-2 focus:ring-[#8B2BE2]/10 transition-all"
                />
                <select
                  value={modalUnit}
                  onChange={(e) => setModalUnit(e.target.value)}
                  className="bg-[#faf8ff] border border-[#e8e0f5] rounded-xl px-3 py-2.5 text-gray-900 focus:outline-none focus:border-[#8B2BE2] transition-all"
                >
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>
              <p className="text-gray-400 text-xs mb-5">Set to 0 or leave blank to remove the limit</p>
              <div className="mb-5 p-3 bg-[#f8f5ff] rounded-xl border border-[#e8e0f5]">
                <p className="text-gray-500 text-xs">Current usage: <span className="text-gray-900 font-mono">{fmtBytes(limitModal.bytesUsed)}</span></p>
                {limitModal.bytesLimit > 0 && (
                  <p className="text-gray-500 text-xs mt-0.5">Current limit: <span className="text-gray-900 font-mono">{fmtBytes(limitModal.bytesLimit)}</span></p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLimitModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#e8e0f5] text-gray-500 text-sm font-semibold hover:text-gray-900 hover:border-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={saveLimit}
                  className="flex-1 py-2.5 rounded-xl bg-[#8B2BE2] hover:bg-[#7B1BD2] text-white font-semibold text-sm transition-all shadow-lg shadow-[#8B2BE2]/20"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#8B2BE2] text-white px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-[#8B2BE2]/30">
          {toast}
        </div>
      )}
    </div>
  );
}
