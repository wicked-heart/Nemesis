interface DoomMaskProps {
  size?: number;
  className?: string;
  glow?: boolean;
  withRunes?: boolean;
}

export default function DoomMask({
  size = 80,
  className = '',
  glow = true,
  withRunes = true,
}: DoomMaskProps) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Background Volumetric Arcane Emerald & Gold Glow */}
      {glow && (
        <>
          <div
            className="absolute -inset-4 rounded-full blur-2xl opacity-40 animate-pulse-glow pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.7) 0%, rgba(245,158,11,0.3) 50%, transparent 75%)',
            }}
          />
          <div
            className="absolute -inset-8 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(5,150,105,0.6) 0%, transparent 70%)',
            }}
          />
        </>
      )}

      {/* Rotating Mystic Latverian Runes / Techno-Circuit Glyphs */}
      {withRunes && (
        <div
          className="absolute pointer-events-none"
          style={{ width: size * 1.55, height: size * 1.55 }}
        >
          {/* Outer Gold Rune Ring */}
          <svg
            className="w-full h-full animate-[spin_40s_linear_infinite]"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle
              cx="100"
              cy="100"
              r="94"
              stroke="rgba(245, 158, 11, 0.35)"
              strokeWidth="1.2"
              strokeDasharray="4 6 12 4 8 8"
            />
            <circle
              cx="100"
              cy="100"
              r="88"
              stroke="rgba(16, 185, 129, 0.25)"
              strokeWidth="0.8"
            />
            {/* Cardinal Arcane Nodes */}
            <circle cx="100" cy="6" r="3" fill="#f59e0b" />
            <circle cx="194" cy="100" r="3" fill="#10b981" />
            <circle cx="100" cy="194" r="3" fill="#f59e0b" />
            <circle cx="6" cy="100" r="3" fill="#10b981" />
          </svg>

          {/* Inner Counter-Rotating Emerald Matrix Ring */}
          <svg
            className="w-full h-full absolute inset-0 animate-[spin_25s_linear_infinite_reverse]"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle
              cx="100"
              cy="100"
              r="76"
              stroke="rgba(16, 185, 129, 0.4)"
              strokeWidth="1"
              strokeDasharray="8 12 2 12"
            />
            {/* Micro notches */}
            <line x1="100" y1="20" x2="100" y2="28" stroke="#34d399" strokeWidth="1.5" />
            <line x1="100" y1="172" x2="100" y2="180" stroke="#34d399" strokeWidth="1.5" />
            <line x1="20" y1="100" x2="28" y2="100" stroke="#34d399" strokeWidth="1.5" />
            <line x1="172" y1="100" x2="180" y2="100" stroke="#34d399" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Main Mask SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_18px_rgba(16,185,129,0.65)] filter transition-transform duration-300 hover:scale-105"
      >
        <defs>
          {/* Hood Forest Green Gradient */}
          <linearGradient id="hoodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#022c19" />
            <stop offset="35%" stopColor="#065f46" />
            <stop offset="65%" stopColor="#047857" />
            <stop offset="85%" stopColor="#022c19" />
            <stop offset="100%" stopColor="#01140a" />
          </linearGradient>

          {/* Hood Shadow / Depth */}
          <linearGradient id="hoodInnerShadow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#000d06" />
            <stop offset="60%" stopColor="#021f12" />
            <stop offset="100%" stopColor="#06381e" />
          </linearGradient>

          {/* Titanium Faceplate Metal */}
          <linearGradient id="metalPlate" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="25%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="75%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Gold Cloak Clasps */}
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Eye Glow */}
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ecfdf5" />
            <stop offset="35%" stopColor="#34d399" />
            <stop offset="70%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>
        </defs>

        {/* --- Outer Hood Cowl Drapes --- */}
        <path
          d="M 50 3 C 24 3, 10 22, 10 52 C 10 72, 18 88, 21 97 C 23 97, 31 89, 36 82 C 27 72, 23 60, 23 48 C 23 29, 33 15, 50 15 C 67 15, 77 29, 77 48 C 77 60, 73 72, 64 82 C 69 89, 77 97, 79 97 C 82 88, 90 72, 90 52 C 90 22, 76 3, 50 3 Z"
          fill="url(#hoodGrad)"
          stroke="#064e3b"
          strokeWidth="1.2"
        />

        {/* --- Hood Peak Fold Detail --- */}
        <path
          d="M 50 3 Q 48 12, 50 20"
          stroke="#01180c"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* --- Deep Hood Inner Cavity --- */}
        <path
          d="M 23 46 C 23 27, 34 17, 50 17 C 66 17, 77 27, 77 46 C 77 67, 68 83, 50 85 C 32 83, 23 67, 23 46 Z"
          fill="url(#hoodInnerShadow)"
        />

        {/* --- Titanium Mask Main Faceplate --- */}
        <path
          d="M 30 38 C 30 29, 39 27, 50 27 C 61 29, 70 29, 70 38 C 70 53, 68 70, 59 78 C 54 83, 46 83, 41 78 C 32 70, 30 53, 30 38 Z"
          fill="url(#metalPlate)"
          stroke="#334155"
          strokeWidth="1.2"
        />

        {/* Cheekbone & Brow Contours */}
        <path
          d="M 31 40 Q 50 35 69 40"
          stroke="#475569"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="33" cy="38" r="1.1" fill="#f8fafc" />
        <circle cx="41" cy="36" r="1.1" fill="#f8fafc" />
        <circle cx="50" cy="35" r="1.1" fill="#f8fafc" />
        <circle cx="59" cy="36" r="1.1" fill="#f8fafc" />
        <circle cx="67" cy="38" r="1.1" fill="#f8fafc" />

        {/* Left Eye Cutout */}
        <path
          d="M 36 44 Q 44 43 45 47 Q 41 50 36 49 Z"
          fill="#000"
          stroke="#1e293b"
          strokeWidth="1"
        />
        {/* Left Glowing Emerald Iris */}
        <ellipse cx="41" cy="46.5" rx="3.6" ry="2" fill="url(#eyeGlow)" />
        <ellipse cx="41" cy="46.5" rx="1.4" ry="0.9" fill="#ffffff" />

        {/* Right Eye Cutout */}
        <path
          d="M 64 44 Q 56 43 55 47 Q 59 50 64 49 Z"
          fill="#000"
          stroke="#1e293b"
          strokeWidth="1"
        />
        {/* Right Glowing Emerald Iris */}
        <ellipse cx="59" cy="46.5" rx="3.6" ry="2" fill="url(#eyeGlow)" />
        <ellipse cx="59" cy="46.5" rx="1.4" ry="0.9" fill="#ffffff" />

        {/* Metallic Nose Bridge */}
        <path
          d="M 50 42 L 47.5 56 L 52.5 56 Z"
          fill="#64748b"
          stroke="#1e293b"
          strokeWidth="0.8"
        />

        {/* Iconic Grim Mouth Grille */}
        <rect
          x="41"
          y="63"
          width="18"
          height="8"
          rx="1"
          fill="#0f172a"
          stroke="#64748b"
          strokeWidth="1"
        />
        <line x1="44" y1="63" x2="44" y2="71" stroke="#000" strokeWidth="1.2" />
        <line x1="47" y1="63" x2="47" y2="71" stroke="#000" strokeWidth="1.2" />
        <line x1="50" y1="63" x2="50" y2="71" stroke="#000" strokeWidth="1.2" />
        <line x1="53" y1="63" x2="53" y2="71" stroke="#000" strokeWidth="1.2" />
        <line x1="56" y1="63" x2="56" y2="71" stroke="#000" strokeWidth="1.2" />

        {/* Armor Rivets */}
        <circle cx="33" cy="54" r="1" fill="#cbd5e1" />
        <circle cx="35" cy="66" r="1" fill="#cbd5e1" />
        <circle cx="67" cy="54" r="1" fill="#cbd5e1" />
        <circle cx="65" cy="66" r="1" fill="#cbd5e1" />

        {/* --- Gold Cloak Chain & Imperial Brooches --- */}
        <path
          d="M 27 89 Q 50 96 73 89"
          stroke="url(#goldGrad)"
          strokeWidth="2.5"
          strokeDasharray="2.5 1.2"
          fill="none"
        />
        {/* Left Brooch Medallion */}
        <circle cx="26" cy="89" r="5.5" fill="url(#goldGrad)" stroke="#78350f" strokeWidth="1.2" />
        <circle cx="26" cy="89" r="2.8" fill="#ca8a04" />
        <circle cx="26" cy="89" r="1.2" fill="#fef08a" />

        {/* Right Brooch Medallion */}
        <circle cx="74" cy="89" r="5.5" fill="url(#goldGrad)" stroke="#78350f" strokeWidth="1.2" />
        <circle cx="74" cy="89" r="2.8" fill="#ca8a04" />
        <circle cx="74" cy="89" r="1.2" fill="#fef08a" />
      </svg>
    </div>
  );
}
