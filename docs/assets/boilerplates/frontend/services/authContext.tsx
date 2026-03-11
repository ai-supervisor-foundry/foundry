import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

export const JWT_KEY = 'chrono_jwt';
const USER_KEY = 'chrono_user';

function parseJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    return JSON.parse(atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
}

function isJwtValid(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || payload.exp == null) return false;
  return payload.exp * 1000 > Date.now();
}

interface AuthContextType {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize user from localStorage synchronously to avoid race condition
function getInitialUser(): User | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(JWT_KEY);
  const storedUser = localStorage.getItem(USER_KEY);
  if (!token || !storedUser) return null;
  if (!isJwtValid(token)) {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getInitialUser);

  // Re-validate token on mount (in case it expired while tab was open)
  useEffect(() => {
    const token = localStorage.getItem(JWT_KEY);
    if (token && !isJwtValid(token)) {
      setUser(null);
      localStorage.removeItem(JWT_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};