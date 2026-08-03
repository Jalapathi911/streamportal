import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtBytes(bytes) {
  if (!bytes)              return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


export default function Dashboard() {
  const [rooms,    setRooms]    = useState([]);
  const [roomName, setRoomName] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function fetchRooms() {
    const res = await apiFetch('/api/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { navigate('/login'); return; }
    setRooms(await res.json());
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    const res = await apiFetch('/api/rooms', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ name: roomName }),
    });
    if (res.ok) { setRoomName(''); fetchRooms(); }
    setLoading(false);
  }

  async function deleteRoom(id) {
    await fetch(`/api/rooms/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchRooms();
  }

  function copyLink(id) {
    navigator.clipboard.writeText(`${window.location.origin}/room/${id}`);
    showToast('Link copied!');
  }

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">

      {/* Sidebar */}
      <aside className="w-60 bg-[#141414] border-r border-[#2a2a2a] flex flex-col p-6">
        <div className="flex flex-col mb-10">
          <img src="/holobox911-logo.png" alt="HoloBox911" className="w-36 object-contain mb-1" />
          <p className="text-[#8B2BE2] text-[9px] font-semibold tracking-widest uppercase">Live stream</p>
        </div>

        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#8B2BE2]/20 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B2BE2" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span className="text-[#8B2BE2] text-sm font-semibold">Rooms</span>
          </div>
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-[#888] hover:text-white text-sm transition-colors"
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
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold text-white mb-1">Rooms</h1>
          <p className="text-[#888] text-sm mb-8">Create and manage your live stream rooms</p>

          {/* Create Room */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 mb-8 max-w-lg">
            <h2 className="text-white font-semibold mb-4">Create Room</h2>
            <form onSubmit={createRoom} className="flex gap-3">
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name…"
                className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-white placeholder-[#444] focus:outline-none focus:border-[#8B2BE2] focus:ring-2 focus:ring-[#8B2BE2]/10 transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#8B2BE2] hover:bg-[#7B1BD2] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#8B2BE2]/20"
              >
                Create
              </button>
            </form>
          </div>

          {/* Room List */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl overflow-hidden">
            <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-[#2a2a2a] text-[#888] text-xs uppercase tracking-wider">
              <span>Name</span>
              <span>Created</span>
              <span>Link</span>
              <span>Actions</span>
              <span>Usage</span>
            </div>

            {rooms.length === 0 ? (
              <p className="text-[#888] text-sm px-6 py-10 text-center">
                No rooms yet. Create one above.
              </p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-[#2a2a2a] last:border-0 items-center hover:bg-[#1a1a1a] transition-colors"
                >
                  <span className="text-white font-medium truncate">{room.name}</span>
                  <span className="text-[#888] text-sm">{timeAgo(room.createdAt)}</span>
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
                  <span className="text-[#6b7280] text-sm font-mono">
                    {fmtBytes(room.bytesUsed)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#8B2BE2] text-white px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-[#8B2BE2]/30">
          {toast}
        </div>
      )}
    </div>
  );
}
