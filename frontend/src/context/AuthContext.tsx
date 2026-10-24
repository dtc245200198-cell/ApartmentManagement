import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'manager' | 'resident';
  email?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('apartment_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('apartment_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem('apartment_token');
      if (!savedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await apiRequest<{ success: boolean; data: User }>('/auth/me');
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('apartment_user', JSON.stringify(res.data));
        } else {
          logout();
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const res = await apiRequest<{
        success: boolean;
        message: string;
        data: { token: string; user: User };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (res.success && res.data) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('apartment_token', res.data.token);
        localStorage.setItem('apartment_user', JSON.stringify(res.data.user));
        return { success: true };
      }
      return { success: false, message: res.message || 'Đăng nhập không thành công' };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Lỗi kết nối đến máy chủ',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('apartment_token');
    localStorage.removeItem('apartment_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
