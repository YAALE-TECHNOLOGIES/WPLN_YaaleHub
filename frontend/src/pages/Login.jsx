import React, { useState } from 'react';
import Logo from '../assets/Logo.svg';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogIn, User, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        const from = location.state?.from?.pathname || '/';
        navigate(from);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass fade-in">
        <div className="login-header">
          <div className="logo-box">
             <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
             <div className="brand-title-wrap">
               <span className="logo-text">Skill Bridge</span>
               <span className="logo-byline">A Product of Yaale Technologies</span>
             </div>
          </div>
          <p>Login to start your assessment</p>
        </div>
        
        {error && <div className="error-alert">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><Mail size={16} /> Email Address</label>
            <input 
              type="email" 
              placeholder="user@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label><Lock size={16} /> Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
          </button>
        </form>
        
        <div className="login-footer">
          <Link to="/" className="back-link"><ArrowLeft size={14} /> Back to Home</Link>
        </div>
      </div>
      
      <style>{`
        .login-container {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
        }
        .login-card {
          width: 420px;
          padding: 40px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-bottom: 12px;
        }
        .brand-logo {
          width: 52px;
          height: auto;
          display: block;
          object-fit: contain;
        }
        .brand-title-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .logo-byline {
          font-size: 11px;
          font-weight: 700;
          color: #007373;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .error-alert {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          text-align: center;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          margin-bottom: 8px;
          color: #64748b;
        }
        .form-group input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        .form-group input:focus {
          border-color: #007373;
          outline: none;
          box-shadow: 0 0 0 3px rgba(0, 115, 115, 0.12);
        }
        .btn-primary {
          width: 100%;
          padding: 12px;
          font-size: 16px;
          background: linear-gradient(135deg, #007373 0%, #005959 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(0, 115, 115, 0.25);
        }
        .btn-primary:hover {
          background: linear-gradient(135deg, #008282 0%, #006666 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0, 115, 115, 0.35);
        }
        .login-footer {
          margin-top: 24px;
          text-align: center;
        }
        .login-footer p { 
          font-size: 14px; 
          color: #64748b; 
          margin-bottom: 12px; 
        }
        .login-footer a {
          color: #007373;
          text-decoration: none;
          font-weight: 600;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          color: #94a3b8 !important;
          font-size: 13px !important;
        }
      `}</style>
    </div>
  );
};

export default Login;
