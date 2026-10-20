// Press-and-hold confirmation. The seal fills while the finger is down and
// signs only when it is full. Releasing early cancels and signs nothing.
export const HOLD_STEPS = 48;

export interface Hold {
  filled: number;
  sealed: boolean;
}

export const idleHold: Hold = { filled: 0, sealed: false };

// One timer tick while held.
export function holdTick(hold: Hold): Hold {
  if (hold.sealed) return hold;
  const filled = Math.min(hold.filled + 1, HOLD_STEPS);
  return { filled, sealed: filled >= HOLD_STEPS };
}

// Finger lifted. A sealed hold stays sealed; anything else starts over.
export function holdRelease(hold: Hold): Hold {
  return hold.sealed ? hold : idleHold;
}
