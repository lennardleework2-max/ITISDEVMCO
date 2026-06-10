import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await auth.me();
      setUser(data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await auth.login({ email, password });
    setUser(data.user);
    return data;
  }

  async function signup(userData) {
    const data = await auth.signup(userData);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  const value = {
    user,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
