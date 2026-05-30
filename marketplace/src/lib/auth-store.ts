// Auth store is now on the backend (Redis + PostgreSQL).
// All auth state is managed via httpOnly cookies.
// This file is kept for backward compat — always return null/empty.
// See: backend/session.rs, backend/account_service/

export const authStore = {
  createUser: () => { throw new Error('Use /api/auth/signup instead'); },
  findByEmail: () => null,
  findById: () => null,
  updateProfile: () => null,
  updateValueSkinsCredential: () => null,
  verifyPassword: () => null,
};
