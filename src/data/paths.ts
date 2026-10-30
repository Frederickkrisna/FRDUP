/** Typed Firestore paths. The only place collection names are spelled. */

import { collection, doc, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { getDb } from './firebase';

export const paths = {
  host: (hostId: string): DocumentReference => doc(getDb(), 'hosts', hostId),
  roster: (hostId: string): CollectionReference => collection(getDb(), 'hosts', hostId, 'roster_players'),
  player: (hostId: string, playerId: string): DocumentReference =>
    doc(getDb(), 'hosts', hostId, 'roster_players', playerId),
  sportStats: (hostId: string, playerId: string, sportId: string): DocumentReference =>
    doc(getDb(), 'hosts', hostId, 'roster_players', playerId, 'sport_stats', sportId),
  sessionResults: (hostId: string, playerId: string): CollectionReference =>
    collection(getDb(), 'hosts', hostId, 'roster_players', playerId, 'session_results'),
  sessionResult: (hostId: string, playerId: string, sessionId: string): DocumentReference =>
    doc(getDb(), 'hosts', hostId, 'roster_players', playerId, 'session_results', sessionId),
  rpEvents: (hostId: string, playerId: string): CollectionReference =>
    collection(getDb(), 'hosts', hostId, 'roster_players', playerId, 'rp_events'),
  rpEvent: (hostId: string, playerId: string, eventId: string): DocumentReference =>
    doc(getDb(), 'hosts', hostId, 'roster_players', playerId, 'rp_events', eventId),

  sessions: (): CollectionReference => collection(getDb(), 'sessions'),
  session: (sessionId: string): DocumentReference => doc(getDb(), 'sessions', sessionId),
  rounds: (sessionId: string): CollectionReference => collection(getDb(), 'sessions', sessionId, 'rounds'),
  round: (sessionId: string, roundId: string): DocumentReference =>
    doc(getDb(), 'sessions', sessionId, 'rounds', roundId),
  cohosts: (sessionId: string): CollectionReference => collection(getDb(), 'sessions', sessionId, 'cohosts'),
  cohost: (sessionId: string, uid: string): DocumentReference =>
    doc(getDb(), 'sessions', sessionId, 'cohosts', uid),
  bill: (sessionId: string): DocumentReference => doc(getDb(), 'sessions', sessionId, 'bill', 'bill'),
  code: (code: string): DocumentReference => doc(getDb(), 'session_codes', code),
  publicBoard: (boardId: string): DocumentReference => doc(getDb(), 'public_boards', boardId),
};
