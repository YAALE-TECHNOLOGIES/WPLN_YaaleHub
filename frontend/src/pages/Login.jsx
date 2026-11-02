import React, { useState } from 'react';
import Logo from '../assets/Logo.svg';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      const role = loggedInUser?.role?.name;
      if (role === 'ADMIN' || role === 'EVALUATOR') {
        navigate('/WPLNadmin');
      } else {
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Ambient background glows */}
      <div className="bg-glow glow-1" />
      <div className="bg-glow glow-2" />
      <div className="bg-grid-pattern" />

      <div className="login-wrapper fade-in">
        <div className="login-card">
          {/* Brand Header */}
          <div className="login-header">
            <div className="brand-logo-container">
              <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
            </div>
            
            <div className="product-badge">
              <span className="badge-pulse" />
              <span>Skill Bridge Platform</span>
            </div>

            <h1 className="login-title">Welcome Back</h1>
            <p className="login-subtitle">Sign in to your assessment portal</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="error-alert fade-in">
              <AlertCircle size={18} className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-field-group">
              <label htmlFor="email" className="input-label">Email Address</label>
              <div className="input-control">
                <Mail size={18} className="input-leading-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="input-field-group">
              <div className="label-row">
                <label htmlFor="password" className="input-label">Password</label>
              </div>
              <div className="input-control">
                <Lock size={18} className="input-leading-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} className="btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Card Footer */}
          <div className="login-footer">
            <Link to="/" className="back-home-link">
              <ArrowLeft size={15} />
              <span>Back to home</span>
            </Link>

            <div className="security-notice">
              <ShieldCheck size={14} />
              <span>Encrypted Assessment Session</span>
            </div>
          </div>
        </div>

        {/* Powered by Yaale Footer */}
        <div className="portal-footer">
          <p>&copy; {new Date().getFullYear()} Yaale Technologies. All rights reserved.</p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f6f6;
          position: relative;
          overflow: hidden;
          padding: 24px 16px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Ambient glowing circles */
        .bg-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
        }
        .glow-1 {
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, rgba(0, 115, 115, 0.16) 0%, rgba(0, 115, 115, 0.02) 70%, transparent 100%);
          top: -120px;
          left: -100px;
        }
        .glow-2 {
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(0, 140, 140, 0.14) 0%, rgba(32, 163, 158, 0.03) 70%, transparent 100%);
          bottom: -140px;
          right: -120px;
        }

        /* Subtle modern grid overlay */
        .bg-grid-pattern {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(0, 115, 115, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 115, 115, 0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }

        .login-wrapper {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .login-card {
          width: 100%;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 24px;
          padding: 40px 36px;
          box-shadow: 
            0 20px 40px -15px rgba(0, 115, 115, 0.12),
            0 0 0 1px rgba(0, 115, 115, 0.06),
            0 4px 6px -2px rgba(0, 0, 0, 0.03);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .login-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 28px;
        }

        .brand-logo-container {
          width: 76px;
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f0f8f8 0%, #ffffff 100%);
          border: 1px solid #d4ecec;
          border-radius: 20px;
          padding: 8px;
          margin-bottom: 16px;
          box-shadow: 0 8px 16px -4px rgba(0, 115, 115, 0.1);
        }

        .brand-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        .product-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eaf5f5;
          color: #007373;
          border: 1px solid #c2e6e6;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .badge-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #007373;
          box-shadow: 0 0 0 2px rgba(0, 115, 115, 0.2);
        }

        .login-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.025em;
          margin: 0 0 6px 0;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 14px;
          color: #64748b;
          margin: 0;
          font-weight: 400;
        }

        .error-alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fee2e2;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .error-icon {
          color: #dc2626;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .input-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .input-label {
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
        }

        .input-control {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .input-leading-icon {
          position: absolute;
          left: 14px;
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s;
        }

        .input-control input {
          width: 100%;
          height: 46px;
          padding: 0 42px 0 42px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          color: #0f172a;
          transition: all 0.2s ease;
          outline: none;
        }

        .input-control input::placeholder {
          color: #94a3b8;
          font-size: 13.5px;
        }

        .input-control input:hover {
          border-color: #cbd5e1;
        }

        .input-control:focus-within .input-leading-icon {
          color: #007373;
        }

        .input-control input:focus {
          border-color: #007373;
          box-shadow: 0 0 0 3px rgba(0, 115, 115, 0.12);
        }

        .password-toggle-btn {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: color 0.2s;
        }

        .password-toggle-btn:hover {
          color: #475569;
        }

        .form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          margin-top: -4px;
        }

        .remember-me {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 13px;
          cursor: pointer;
          user-select: none;
        }

        .remember-me input[type="checkbox"] {
          accent-color: #007373;
          width: 15px;
          height: 15px;
          cursor: pointer;
        }

        .btn-submit {
          height: 48px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: linear-gradient(135deg, #007373 0%, #005656 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 16px -4px rgba(0, 115, 115, 0.35);
          margin-top: 6px;
        }

        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #008282 0%, #006060 100%);
          transform: translateY(-1px);
          box-shadow: 0 12px 20px -4px rgba(0, 115, 115, 0.45);
        }

        .btn-submit:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 4px 8px -2px rgba(0, 115, 115, 0.3);
        }

        .btn-submit:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .btn-arrow {
          transition: transform 0.2s ease;
        }

        .btn-submit:hover .btn-arrow {
          transform: translateX(3px);
        }

        .login-footer {
          margin-top: 26px;
          padding-top: 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }

        .back-home-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #64748b;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .back-home-link:hover {
          color: #007373;
        }

        .security-notice {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #94a3b8;
          font-size: 11.5px;
          font-weight: 500;
        }

        .portal-footer {
          margin-top: 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 32px 24px;
            border-radius: 20px;
          }
          .login-footer {
            flex-direction: column;
            gap: 12px;
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
