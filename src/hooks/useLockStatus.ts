import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PlayerStatus } from '@/lib/types';

export type LockPhase = 'IDLE' | 'LOCKED' | 'RELEASING';

interface UseLockStatusProps {
  playerStatus: PlayerStatus;
  sessionId?: string;
  onRefreshSession: () => Promise<void>;
}

export function useLockStatus({
  playerStatus,
  sessionId,
  onRefreshSession,
}: UseLockStatusProps) {
  const [phase, setPhase] = useState<LockPhase>(() => {
    return playerStatus === 'PENALTY_PENDING' ? 'LOCKED' : 'IDLE';
  });

  const prevStatusRef = useRef<PlayerStatus>(playerStatus);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition handler when playerStatus changes
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = playerStatus;

    if (playerStatus === 'PENALTY_PENDING') {
      setPhase('LOCKED');
      try {
        localStorage.setItem('nemesis_lock_displayed', new Date().toISOString());
      } catch {
        // Ignore storage quota
      }
    } else if (playerStatus === 'NORMAL') {
      if (prev === 'PENALTY_PENDING') {
        // Transition: LOCKED -> NORMAL: Run Release (~2 seconds)
        setPhase('RELEASING');

        if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = setTimeout(() => {
          setPhase('IDLE');
        }, 2000);
      } else {
        setPhase('IDLE');
      }
    }
  }, [playerStatus]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  // Real-time detection & polling while locked
  useEffect(() => {
    if (phase !== 'LOCKED') return;

    // 1. Supabase Realtime channel subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (sessionId) {
      channel = supabase
        .channel(`lock-status-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'game_sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const newStatus = payload.new?.player_status;
            if (newStatus && newStatus !== 'PENALTY_PENDING') {
              onRefreshSession();
            }
          }
        )
        .subscribe();
    }

    // 2. Heartbeat polling fallback (every 2.5s) while locked
    const interval = setInterval(() => {
      onRefreshSession();
    }, 2500);

    return () => {
      clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [phase, sessionId, onRefreshSession]);

  return {
    phase,
    isLocked: phase === 'LOCKED' || phase === 'RELEASING',
    isPersistentLocked: phase === 'LOCKED',
  };
}
