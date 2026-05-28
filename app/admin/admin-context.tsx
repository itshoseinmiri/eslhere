'use client';

import { createContext, useContext } from 'react';

export interface AdminContextType {
  token: string;
  logout: () => Promise<void>;
}

export const AdminContext = createContext<AdminContextType | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminLayout');
  return ctx;
}
