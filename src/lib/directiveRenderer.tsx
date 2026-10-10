import React from 'react';

export function renderClassifiedContent(content: string) {
  if (!content) return null;

  // 1. Normalize line endings (CRLF -> LF, CR -> LF) and wording
  let normalized = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/8 points for every confirmed target/gi, '8 points from every confirmed target')
    .trim();

  // 2. Ensure paragraphs are broken out even if incoming text had flattened newlines
  normalized = normalized
    .replace(/(?<!\n\n)(\*\*(?:Psst|Your reward|Your objective|This message))/gi, '\n\n$1')
    .replace(/(?<!\n\n)(Doom is hunting down|Targets include|\*Trust no one)/gi, '\n\n$1');

  const blocks = normalized.split(/\n{2,}/).filter((b) => b.trim().length > 0);

  // Helper to render inline markdown (bold/italic) cleanly without raw asterisks
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <span key={pIdx} className="text-zinc-200 font-semibold">
            {inner}
          </span>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <span key={pIdx} className="text-zinc-400 italic">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 font-mono text-[11px] sm:text-xs text-left select-text">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();

        // 1. Header Block (Title)
        if (trimmed.startsWith('### ') || trimmed.startsWith('☠️') || trimmed.toUpperCase().includes('OPERATION DOOM')) {
          const rawTitle = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
          return (
            <div
              key={idx}
              className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-800/80"
            >
              <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-xs tracking-wide">
                <span>☠️</span>
                <span className="text-amber-400/90 font-semibold">
                  {rawTitle.replace(/^☠️\s*/, '')}
                </span>
              </div>
              <span className="text-[9px] text-zinc-500 tracking-widest uppercase hidden sm:inline">
                INTERNAL ARBITER DISPATCH
              </span>
            </div>
          );
        }

        // 2. Whisper Block ("Psst...")
        if (trimmed.toLowerCase().includes('psst')) {
          return (
            <p key={idx} className="text-zinc-400 italic text-[11px] leading-relaxed">
              {renderInline(trimmed)}
            </p>
          );
        }

        // 3. Reward Line
        if (trimmed.toLowerCase().startsWith('**your reward:') || trimmed.toLowerCase().startsWith('your reward:')) {
          const cleanText = trimmed.replace(/^\*\*your reward:\*\*\s*/i, '').replace(/^your reward:\s*/i, '');
          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 py-1 px-2.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px]"
            >
              <span className="text-zinc-400 font-medium shrink-0">Your reward:</span>
              <span className="text-amber-400 font-bold tracking-wide text-right">
                {renderInline(cleanText)}
              </span>
            </div>
          );
        }

        // 4. Objective Line
        if (trimmed.toLowerCase().startsWith('**your objective:') || trimmed.toLowerCase().startsWith('your objective:')) {
          const cleanText = trimmed.replace(/^\*\*your objective:\*\*\s*/i, '').replace(/^your objective:\s*/i, '');
          return (
            <div
              key={idx}
              className="flex items-start gap-2 py-1 px-2.5 rounded bg-zinc-900/60 border border-zinc-800/80 text-[11px]"
            >
              <span className="text-zinc-400 font-medium shrink-0">Your objective:</span>
              <span className="text-zinc-300 leading-relaxed">
                {renderInline(cleanText)}
              </span>
            </div>
          );
        }

        // 5. Caution / Footnote Line
        if (trimmed.toLowerCase().includes('trust no one')) {
          return (
            <p key={idx} className="text-zinc-500 italic text-[10.5px] tracking-wide pt-0.5">
              {trimmed.replace(/\*/g, '')}
            </p>
          );
        }

        // 6. Classification Warning
        if (trimmed.toLowerCase().includes('proceed discreetly')) {
          return (
            <div
              key={idx}
              className="text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-900/80 flex items-center gap-1.5 tracking-wider uppercase font-medium"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/70" />
              <span>{trimmed.replace(/\*\*/g, '').replace(/\*/g, '')}</span>
            </div>
          );
        }

        // Standard Paragraphs (Context & Targets)
        return (
          <p key={idx} className="text-zinc-400 leading-relaxed text-[11px] sm:text-xs">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
