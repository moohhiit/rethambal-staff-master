import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const expiry = await AsyncStorage.getItem('tokenExpiry');

      if (token && expiry && Date.now() < Number(expiry)) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: any) => {
    await AsyncStorage.setItem('authToken', data.token);
    await AsyncStorage.setItem('tokenExpiry', data.expiry.toString());
    await AsyncStorage.setItem('userData', JSON.stringify(data.user));
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
