// Doom's face (a crop of the 3D model's still image) for small icons in headers and cards. UI only.
export default function DoomFace({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/models/doom-face.webp"
      alt=""
      draggable={false}
      decoding="async"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`doom-face shrink-0 rounded-full object-cover select-none ${className}`}
    />
  );
}
