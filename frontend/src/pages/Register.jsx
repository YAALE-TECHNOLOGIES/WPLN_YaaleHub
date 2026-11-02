import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Lock, Mail, Loader2, ArrowLeft } from 'lucide-react';
import Logo from '../assets/Logo.svg';
import api from '../api/api';

const Register = () => {
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (formData.password !== formData.confirmPassword) {
            return setError("Passwords do not match");
        }

        setLoading(true);
        try {
            await api.post('/auth/register', {
                fullname: formData.fullname,
                email: formData.email,
                password: formData.password,
                role_id: 3 // Hardcoded 3 for CANDIDATE role
            });
            // Redirect to login after successful registration
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Use a different email.');
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
                    <h1>Create Account</h1>
                    <p>Register to start your assessment journey</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <label>Full Name</label>
                        <div className="input-wrapper">
                            <User className="input-icon" size={20} />
                            <input
                                type="text"
                                name="fullname"
                                placeholder="Enter your full name"
                                value={formData.fullname}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Email Address</label>
                        <div className="input-wrapper">
                            <Mail className="input-icon" size={20} />
                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                name="password"
                                placeholder="Create a password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Confirm Password</label>
                        <div className="input-wrapper">
                            <Lock className="input-icon" size={20} />
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : 'Register Now'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>Already have an account? <Link to="/login">Sign In</Link></p>
                    <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to Home</Link>
                </div>
            </div>
            
            <style jsx>{`
                .login-container { height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at top right, #eaf5f5, #f8fafc); padding: 20px; }
                .login-card { width: 100%; max-width: 450px; padding: 48px; border-radius: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.4); }
                .login-header { text-align: center; margin-bottom: 32px; }
                .logo-box { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 16px; }
                .brand-logo { width: 52px; height: auto; display: block; object-fit: contain; }
                .brand-title-wrap { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
                .logo-text { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2; }
                .logo-byline { font-size: 11px; font-weight: 700; color: #007373; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px; }
                .login-header h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
                .login-header p { color: #64748b; font-size: 14px; }
                .error-message { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 12px; margin-bottom: 24px; font-size: 14px; font-weight: 500; border: 1px solid #fee2e2; }
                .input-group { margin-bottom: 20px; }
                .input-group label { display: block; font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
                .input-wrapper { position: relative; }
                .input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .input-wrapper input { width: 100%; padding: 14px 14px 14px 48px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 15px; transition: all 0.2s; outline: none; }
                .input-wrapper input:focus { border-color: #007373; box-shadow: 0 0 0 4px rgba(0, 115, 115, 0.1); }
                .login-btn { width: 100%; height: 52px; background: #007373; color: white; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; margin-top: 32px; box-shadow: 0 10px 15px -3px rgba(0, 115, 115, 0.35); }
                .login-btn:hover { background: #005959; transform: translateY(-1px); }
                .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                .login-footer { text-align: center; margin-top: 32px; }
                .login-footer p { font-size: 14px; color: #64748b; margin-bottom: 16px; }
                .login-footer a { color: #007373; font-weight: 700; text-decoration: none; }
                .back-link { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: #64748b !important; font-weight: 500 !important; }
            `}</style>
        </div>
    );
};

export default Register;
