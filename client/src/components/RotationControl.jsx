const ROTATIONS = [0, 90, 180, 270];

const ICONS = {
  0: '↑',
  90: '→',
  180: '↓',
  270: '←',
};

export default function RotationControl({ currentRotation, onRotate, label }) {
  return (
    <div>
      {label && <p className="text-[#888] text-xs mb-2">{label}</p>}
      <div className="flex gap-2">
        {ROTATIONS.map((deg) => (
          <button
            key={deg}
            onClick={() => onRotate(deg)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors border ${
              currentRotation === deg
                ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#7c3aed] hover:text-white'
            }`}
          >
            {ICONS[deg]} {deg}°
          </button>
        ))}
      </div>
    </div>
  );
}
