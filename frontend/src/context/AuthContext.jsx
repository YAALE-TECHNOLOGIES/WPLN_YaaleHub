import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import api from '../api/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.exp * 1000 < Date.now()) {
            // Access token expired — try refresh via fetchProfile
            // The api interceptor will auto-refresh; if it fails it redirects to /login
            await fetchProfile();
          } else {
            const savedUser = JSON.parse(localStorage.getItem('user'));
            if (savedUser) {
              setUser(savedUser);
            } else {
              await fetchProfile();
            }
          }
        } catch (err) {
          logout();
        }
      }
      setLoading(false); // ← always wait for async work to finish first
    };
    init();
  }, []);


  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      // If api.js handled the refresh and failed, it already cleared storage and redirected
      // But we should still clear local state if possible
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  const login = async (email, password) => {
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const res = await api.post('/auth/login', params);
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('refreshToken', refresh_token);

      // Get profile
      const userRes = await api.get('/auth/me');
      setUser(userRes.data);
      localStorage.setItem('user', JSON.stringify(userRes.data));
      return userRes.data; // ← return user so caller can read role for redirect
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
