import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
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
    const res = await fetch('/api/rooms', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { navigate('/login'); return; }
    setRooms(await res.json());
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: roomName }),
    });
    if (res.ok) { setRoomName(''); fetchRooms(); }
    setLoading(false);
  }

  async function deleteRoom(id) {
    await fetch(`/api/rooms/${id}`, {
      method: 'DELETE',
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
      <aside className="w-56 bg-[#141414] border-r border-[#2a2a2a] flex flex-col p-6">
        <h2 className="text-lg font-bold text-white mb-8">StreamPortal</h2>
        <div className="flex-1" />
        <button onClick={logout} className="text-[#888] hover:text-white text-sm transition-colors text-left">
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>

        {/* Create Room */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 mb-8 max-w-lg">
          <h2 className="text-white font-semibold mb-4">Create Room</h2>
          <form onSubmit={createRoom} className="flex gap-3">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name…"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white placeholder-[#555] focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              Create
            </button>
          </form>
        </div>

        {/* Room List */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-[#2a2a2a] text-[#888] text-xs uppercase tracking-wider">
            <span>Name</span>
            <span>Created</span>
            <span>Link</span>
            <span>Actions</span>
            <span>Usage</span>
          </div>

          {rooms.length === 0 ? (
            <p className="text-[#888] text-sm px-6 py-8">No rooms yet. Create one above.</p>
          ) : (
            rooms.map((room) => (
              <div
                key={room.id}
                className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-[#2a2a2a] last:border-0 items-center"
              >
                <span className="text-white font-medium truncate">{room.name}</span>
                <span className="text-[#888] text-sm">{timeAgo(room.createdAt)}</span>
                <button
                  onClick={() => copyLink(room.id)}
                  className="text-[#7c3aed] hover:text-[#a78bfa] text-sm transition-colors text-left"
                >
                  Copy link
                </button>
                <button
                  onClick={() => deleteRoom(room.id)}
                  className="text-red-500 hover:text-red-400 text-sm transition-colors text-left"
                >
                  Delete
                </button>
                <span className="text-[#888] text-sm font-mono">
                  {fmtBytes(room.bytesUsed)}
                </span>
              </div>
            ))
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#7c3aed] text-white px-4 py-2 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
