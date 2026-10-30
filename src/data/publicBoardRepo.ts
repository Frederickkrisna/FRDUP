/** public_boards repository. Host writes a read-only snapshot; anyone with the id can read it. */

import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';

import type { Id } from '@/types/common';
import type { PublicBoardDoc } from '@/types/publicBoard';
import { createId } from '@/core/utils/id';
import { encode, decode } from './converters';
import { track } from './observable';
import { paths } from './paths';

const BOARD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const publicBoardRepo = {
  /**
   * Publish a snapshot for the finished session. Returns the new boardId.
   * Fire-and-forget write tracked by observable.ts (same pattern as the rest of the codebase).
   */
  publish(board: Omit<PublicBoardDoc, 'id' | 'createdAt' | 'expiresAt'>): Id {
    const now = Date.now();
    const id = createId();
    const doc_: PublicBoardDoc = {
      ...board,
      id,
      createdAt: now,
      expiresAt: now + BOARD_TTL_MS,
    };
    track('publicBoard.publish', setDoc(paths.publicBoard(id), encode(doc_)));
    return id;
  },

  /** Read a public board by id. Returns null if missing or expired (handled by rules). */
  async get(boardId: Id): Promise<PublicBoardDoc | null> {
    const snap = await getDoc(paths.publicBoard(boardId));
    if (!snap.exists()) return null;
    return decode<PublicBoardDoc>(snap.data());
  },

  /** Host-only: remove the board before it expires naturally. */
  remove(boardId: Id): void {
    track('publicBoard.remove', deleteDoc(paths.publicBoard(boardId)));
  },
};
