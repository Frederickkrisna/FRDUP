/**
 * Auth repository — exposes authentication operations to features and routes
 * without importing Firebase directly in UI layers.
 */
import {
  ensureSignedIn,
  signInWithCredentials,
  signOutDevice,
  currentUid,
} from './firebase';

export const authRepo = {
  ensureSignedIn,
  signInWithCredentials,
  signOutDevice,
  currentUid,
};

export { signInWithCredentials, signOutDevice, currentUid, ensureSignedIn };
