import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';

export interface WheelPenalty {
  id: string;
  name: string;
  label: string;
  color: string;
  colorDark: string;
  pipColor: string;
}

// Exactly 6 sections so the two-tone palette (Doom Cloak Emerald vs Plated Iron) alternates seamlessly
export const WHEEL_PENALTIES: WheelPenalty[] = [
  {
    id: 'bitter_gourd_juice',
    name: 'Bitter Gourd Juice',
    label: 'BITTER GOURD JUICE',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'pick_up_line',
    name: 'Pick Up Line',
    label: 'PICK UP LINE',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
  {
    id: 'movie_action',
    name: 'Movie Action',
    label: 'MOVIE ACTION',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'movie_dialogue',
    name: 'Movie Dialogue',
    label: 'MOVIE DIALOGUE',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
  {
    id: 'ai_image_prompt',
    name: 'AI Image Prompt',
    label: 'AI IMAGE PROMPT',
    color: '#0f3d24', // Cloak Emerald
    colorDark: '#072113',
    pipColor: '#22c55e',
  },
  {
    id: 'green_chilli',
    name: 'Green Chilli',
    label: 'GREEN CHILLI',
    color: '#151d18', // Plated Iron
    colorDark: '#0c120e',
    pipColor: '#8a9a90',
  },
];

const SEGMENTS_COUNT = WHEEL_PENALTIES.length; // Exactly 6 sections (60° each)

export default function WheelOfDoom() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio synthesis via Web Audio API for mechanical peg ticks
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playTickSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.025);

      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } catch {
      // Audio context might be restricted before gesture; safe to ignore
    }
  }, [getAudioContext]);

  const playVictorySound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const notes = [392, 523.25, 659.25, 783.99]; // Regal Latverian triad
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = ctx.currentTime + idx * 0.09;
        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.42);
      });
    } catch {
      // ignore
    }
  }, [getAudioContext]);

  // Wheel State
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0); // in radians
  const [lastVerdict, setLastVerdict] = useState<WheelPenalty | null>(null);

  // Ticker flapper spring deflection (in radians)
  const flapperDeflection = useRef(0);
  const lastPegIndex = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const currentRotationRef = useRef(0);

  // Helper: determine which segment is at the pointer (pointer is at 3 o'clock / East / angle 0)
  const getSegmentAtAngle = useCallback((rot: number): WheelPenalty => {
    const step = (Math.PI * 2) / SEGMENTS_COUNT;
    const localAngle = ((-rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor((localAngle + step / 2) / step) % SEGMENTS_COUNT;
    return WHEEL_PENALTIES[index];
  }, []);

  // Canvas drawing routine
  const renderWheel = useCallback((rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 640;
    const targetW = Math.round(size * dpr);
    const targetH = Math.round(size * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Always reset transform explicitly so scaling NEVER compounds across renders
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = 278;
    const innerWedgeR = 248;
    const hubR = 56;
    const step = (Math.PI * 2) / SEGMENTS_COUNT; // 60 degrees per wedge

    // 1. Outer Latverian Iron & Steel Rim
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 12, 0, Math.PI * 2);
    ctx.fillStyle = '#040605'; // doom-void
    ctx.fill();

    // Outer rim gradient ring: Plated Iron with steel highlight
    const rimGrad = ctx.createRadialGradient(cx, cy, innerWedgeR, cx, cy, outerR + 8);
    rimGrad.addColorStop(0, '#0b100d'); // doom-iron
    rimGrad.addColorStop(0.4, '#1b2620');
    rimGrad.addColorStop(0.75, '#121a15'); // doom-raised
    rimGrad.addColorStop(1, '#050907');
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 6, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerWedgeR + 2, 0, Math.PI * 2, true);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Outer rim hairline Doom green border
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.45)'; // doom-green accent ring
    ctx.stroke();

    // Inner rim Doom steel boundary
    ctx.beginPath();
    ctx.arc(cx, cy, innerWedgeR + 2, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(201, 209, 214, 0.35)'; // doom-steel
    ctx.stroke();
    ctx.restore();

    // 2. Draw Wheel Segments (Rotated) - Exactly 6 Slices (Alternating Emerald & Iron)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    WHEEL_PENALTIES.forEach((penalty, i) => {
      const segAngle = i * step;
      const startAngle = segAngle - step / 2;
      const endAngle = segAngle + step / 2;

      // Wedge slice
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, innerWedgeR, startAngle, endAngle);
      ctx.closePath();

      // Wedge radial gradient in emerald & iron tones
      const segGrad = ctx.createRadialGradient(0, 0, hubR, 0, 0, innerWedgeR);
      segGrad.addColorStop(0, penalty.colorDark);
      segGrad.addColorStop(0.65, penalty.color);
      segGrad.addColorStop(1, penalty.colorDark);
      ctx.fillStyle = segGrad;
      ctx.fill();

      // Dividing spoke lines in Doom steel
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(startAngle) * innerWedgeR, Math.sin(startAngle) * innerWedgeR);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = 'rgba(201, 209, 214, 0.4)'; // doom-steel
      ctx.stroke();

      // Outer rim indicator pip block (emerald/steel accent)
      ctx.save();
      ctx.rotate(segAngle);

      const blockW = 28;
      const blockH = 12;
      const blockX = innerWedgeR - 34;
      ctx.fillStyle = penalty.pipColor;
      ctx.shadowColor = penalty.pipColor;
      ctx.shadowBlur = 6;
      ctx.fillRect(blockX, -blockH / 2, blockW, blockH);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(201, 209, 214, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(blockX, -blockH / 2, blockW, blockH);

      // Radial label in Doom Text (#e7efe9)
      ctx.fillStyle = '#e7efe9';
      ctx.font = 'bold 11px "Space Grotesk", "JetBrains Mono", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(penalty.label, innerWedgeR - 44, 0);
      ctx.restore();
    });

    // 3. Metallic Dividing Pegs (6 Boundary Pegs in Doom Steel)
    for (let i = 0; i < SEGMENTS_COUNT; i++) {
      const dividerAngle = i * step - step / 2;
      const pegR = innerWedgeR + 14;
      const px = Math.cos(dividerAngle) * pegR;
      const py = Math.sin(dividerAngle) * pegR;

      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0b100d';
      ctx.fill();

      const pegGrad = ctx.createRadialGradient(px - 1, py - 1, 1, px, py, 4);
      pegGrad.addColorStop(0, '#ffffff');
      pegGrad.addColorStop(0.4, '#c9d1d6'); // doom-steel
      pegGrad.addColorStop(0.85, '#8a9a90'); // doom-muted
      pegGrad.addColorStop(1, '#343e38');
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = pegGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    ctx.restore(); // End wheel rotated transform

    // 4. Center Iron Hub (Doom Steel Bezel & Latverian Insignia)
    ctx.save();
    const hubBezelGrad = ctx.createRadialGradient(cx, cy, hubR - 8, cx, cy, hubR + 6);
    hubBezelGrad.addColorStop(0, '#c9d1d6'); // doom-steel
    hubBezelGrad.addColorStop(0.5, '#4b5750');
    hubBezelGrad.addColorStop(0.85, '#22c55e'); // doom-green
    hubBezelGrad.addColorStop(1, '#0b100d'); // doom-iron

    ctx.beginPath();
    ctx.arc(cx, cy, hubR + 5, 0, Math.PI * 2);
    ctx.fillStyle = hubBezelGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 209, 214, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dark Iron inner plate
    const hubInnerGrad = ctx.createRadialGradient(cx - 8, cy - 8, 8, cx, cy, hubR - 4);
    hubInnerGrad.addColorStop(0, '#151b17');
    hubInnerGrad.addColorStop(0.7, '#0b100d');
    hubInnerGrad.addColorStop(1, '#040605');

    ctx.beginPath();
    ctx.arc(cx, cy, hubR - 3, 0, Math.PI * 2);
    ctx.fillStyle = hubInnerGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, hubR - 8, 0, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.stroke();

    // Latverian Sovereign Typography
    ctx.fillStyle = '#e7efe9';
    ctx.font = '900 12px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '1.5px';
    ctx.fillText('DOOM', cx, cy - 7);

    ctx.fillStyle = '#4ade80'; // doom-glow
    ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
    ctx.fillText('VERDICT', cx, cy + 7);
    ctx.restore();

    // 5. Triangular Pointer at 3 O'CLOCK (Right Rim, Doom Steel with Emerald Tip)
    ctx.save();
    const pointerBaseX = cx + innerWedgeR + 24;
    const pointerY = cy;
    const pointerTipX = cx + innerWedgeR - 6;
    const pointerHalfH = 15;

    ctx.translate(pointerBaseX, pointerY);
    ctx.rotate(flapperDeflection.current);
    ctx.translate(-pointerBaseX, -pointerY);

    ctx.beginPath();
    ctx.moveTo(pointerBaseX + 6, pointerY - pointerHalfH - 2);
    ctx.lineTo(pointerTipX - 2, pointerY);
    ctx.lineTo(pointerBaseX + 6, pointerY + pointerHalfH + 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 8;
    ctx.fill();

    // Brushed Doom Steel gradient body
    const pointerGrad = ctx.createLinearGradient(pointerBaseX, pointerY - pointerHalfH, pointerTipX, pointerY);
    pointerGrad.addColorStop(0, '#e7efe9');
    pointerGrad.addColorStop(0.5, '#c9d1d6'); // doom-steel
    pointerGrad.addColorStop(1, '#8a9a90');

    ctx.beginPath();
    ctx.moveTo(pointerBaseX, pointerY - pointerHalfH);
    ctx.lineTo(pointerTipX, pointerY);
    ctx.lineTo(pointerBaseX, pointerY + pointerHalfH);
    ctx.closePath();
    ctx.fillStyle = pointerGrad;
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.7)'; // emerald hairline
    ctx.stroke();

    // Pointer glowing emerald jewel pip
    ctx.beginPath();
    ctx.arc(pointerBaseX - 7, pointerY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#22c55e'; // doom-green
    ctx.fill();
    ctx.strokeStyle = '#e7efe9';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }, []);

  // Redraw when rotation changes
  useEffect(() => {
    currentRotationRef.current = currentRotation;
    renderWheel(currentRotation);
  }, [currentRotation, renderWheel]);

  useEffect(() => {
    renderWheel(currentRotationRef.current);
  }, [renderWheel]);

  // Spin trigger function
  const spinWheel = useCallback(() => {
    if (isSpinning) return;

    setIsSpinning(true);
    setLastVerdict(null);

    getAudioContext();

    // Physics parameters: strictly <= 3.5s (3.2s)
    const SPIN_DURATION_MS = 3200;
    const startRot = currentRotationRef.current;

    // Spin 6 to 9 full turns + random target slice offset
    const fullSpins = 6 + Math.random() * 3;
    const randomOffset = Math.random() * Math.PI * 2;
    const totalRotationDelta = fullSpins * Math.PI * 2 + randomOffset;
    const targetEndRot = startRot + totalRotationDelta;

    const startTime = performance.now();
    const step = (Math.PI * 2) / SEGMENTS_COUNT;

    lastPegIndex.current = Math.floor(startRot / step);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / SPIN_DURATION_MS);

      // Quartic ease-out deceleration curve for realistic physical friction
      const easeOut = 1 - Math.pow(1 - progress, 4.2);

      const currentAngle = startRot + totalRotationDelta * easeOut;
      setCurrentRotation(currentAngle);

      const currentPeg = Math.floor(currentAngle / step);
      if (currentPeg !== lastPegIndex.current) {
        lastPegIndex.current = currentPeg;
        flapperDeflection.current = -0.22;
        playTickSound();
      }

      flapperDeflection.current *= 0.82;
      if (Math.abs(flapperDeflection.current) < 0.005) {
        flapperDeflection.current = 0;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        flapperDeflection.current = 0;
        setCurrentRotation(targetEndRot);

        const finalPenalty = getSegmentAtAngle(targetEndRot);
        setLastVerdict(finalPenalty);
        playVictorySound();
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isSpinning, getAudioContext, playTickSound, playVictorySound, getSegmentAtAngle]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-4 animate-fade-in font-mono select-none">
      {/* The Roulette Wheel Canvas */}
      <div className="relative flex items-center justify-center w-full max-w-[520px] aspect-square">
        <canvas
          ref={canvasRef}
          className="w-full h-full drop-shadow-[0_0_35px_rgba(34,197,94,0.18)] cursor-pointer"
          onClick={!isSpinning ? spinWheel : undefined}
          title={isSpinning ? 'Spinning...' : 'Click to spin'}
        />
      </div>

      {/* Result Display: Shown after the wheel stops spinning */}
      {lastVerdict && !isSpinning && (
        <div className="mt-6 text-center animate-fade-in space-y-1">
          <div className="text-[11px] font-mono tracking-[0.3em] text-doom-muted uppercase">
            PENALTY VERDICT
          </div>
          <div className="font-regal text-3xl sm:text-5xl font-bold uppercase tracking-wider text-doom-glow drop-shadow-[0_0_20px_rgba(74,222,128,0.35)]">
            {lastVerdict.name}
          </div>
        </div>
      )}

      {/* Spin Button in Nemesis Emerald Sovereign style */}
      <div className="mt-6">
        <button
          onClick={spinWheel}
          disabled={isSpinning}
          className={`px-10 py-3.5 rounded-full font-mono font-bold text-xs tracking-[0.2em] uppercase transition-all duration-300 flex items-center gap-2.5 border ${
            isSpinning
              ? 'bg-doom-iron border-doom-line text-doom-muted cursor-not-allowed shadow-none'
              : 'bg-doom-green hover:bg-doom-glow text-black border-doom-green/80 shadow-[0_0_25px_rgba(34,197,94,0.35)] hover:scale-105 active:scale-95'
          }`}
        >
          {isSpinning ? (
            <>
              <RotateCcw size={15} className="animate-spin text-doom-green" />
              <span>DECIDING FATE...</span>
            </>
          ) : (
            <span>SPIN WHEEL</span>
          )}
        </button>
      </div>
    </div>
  );
}
