import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  branchId: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  branchId: string | null;
  login: (payload: { accessToken: string; refreshToken: string; user?: AuthUser }) => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setBranch: (branchId: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      tenantId: null,
      branchId: null,

      login: (payload) =>
        set({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          user: payload.user || null,
          tenantId: payload.user?.tenantId || null,
          branchId: payload.user?.role === 'owner' ? null : (payload.user?.branchId || null),
        }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, tenantId: null, branchId: null }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setBranch: (branchId) => set({ branchId }),
    }),
    { name: 'dinestay-auth' },
  ),
);
