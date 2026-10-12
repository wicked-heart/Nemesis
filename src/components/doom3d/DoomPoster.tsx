// A still image of the 3D Doom, rendered from the same model (public/models/doom-poster*.webp). It shows
// while the 3D loads (a thin scan of light sweeps over Doom's outline, as if he is materialising) and stays
// on devices that can't run 3D. UI only.

const POSTER = { green: '/models/doom-poster.webp', red: '/models/doom-poster-red.webp' };

export default function DoomPoster({ red = false, dim = false }: { red?: boolean; dim?: boolean }) {
  const src = red ? POSTER.red : POSTER.green;
  return (
    <div className={`doom-poster absolute inset-0 ${dim ? 'opacity-75 grayscale-[0.45]' : ''}`}>
      <img src={src} alt="" draggable={false} decoding="async" className="absolute inset-[4%] w-[92%] h-[92%] object-contain select-none" />
      <div aria-hidden className={`doom-poster-scan absolute inset-[4%] ${red ? 'is-red' : ''}`} style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />
    </div>
  );
}
