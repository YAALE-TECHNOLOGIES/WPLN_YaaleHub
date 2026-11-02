import axios from 'axios';

const rawBase = import.meta.env.VITE_API_BASE_URL || 'https://api-wpln.greenmark.com.sg/api';
const normalizedBase = rawBase.startsWith('http') ? rawBase : `https://${rawBase}`;

const api = axios.create({
  baseURL: normalizedBase,
});

// For media assets (backend root)
export const BASE_URL = normalizedBase.replace(/\/api\/?$/, '');

// Add auth header on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add 401 interceptor — auto-refresh access token using refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry if already retried, or if this IS the refresh endpoint itself
    const isRefreshCall = originalRequest.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          // Send refresh token as a query param (matches backend signature)
          const res = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            null,
            { params: { refresh_token: refreshToken } }
          );

          const { access_token, refresh_token: newRefreshToken } = res.data;
          localStorage.setItem('token', access_token);
          localStorage.setItem('refreshToken', newRefreshToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh token expired or invalid — force logout
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token at all — go to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
