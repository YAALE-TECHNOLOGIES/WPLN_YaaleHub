import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Mail, Loader2, ArrowLeft, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Logo from '../assets/Logo.svg';
import api from '../api/api';

const Register = () => {
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
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
                role_id: 3 // CANDIDATE role
            });
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Use a different email.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="bg-glow glow-1" />
            <div className="bg-glow glow-2" />
            <div className="bg-grid-pattern" />

            <div className="register-wrapper fade-in">
                <div className="register-card">
                    <div className="register-header">
                        <div className="brand-logo-container">
                            <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
                        </div>

                        <div className="product-badge">
                            <span className="badge-pulse" />
                            <span>Skill Bridge Platform</span>
                        </div>

                        <h1 className="register-title">Create Account</h1>
                        <p className="register-subtitle">Register to begin your candidate assessment</p>
                    </div>

                    {error && (
                        <div className="error-alert fade-in">
                            <AlertCircle size={18} className="error-icon" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="register-form">
                        <div className="input-field-group">
                            <label className="input-label">Full Name</label>
                            <div className="input-control">
                                <User size={18} className="input-leading-icon" />
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

                        <div className="input-field-group">
                            <label className="input-label">Email Address</label>
                            <div className="input-control">
                                <Mail size={18} className="input-leading-icon" />
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

                        <div className="input-field-group">
                            <label className="input-label">Password</label>
                            <div className="input-control">
                                <Lock size={18} className="input-leading-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    placeholder="Create a strong password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="input-field-group">
                            <label className="input-label">Confirm Password</label>
                            <div className="input-control">
                                <Lock size={18} className="input-leading-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span>Creating account...</span>
                                </>
                            ) : (
                                <>
                                    <span>Register Now</span>
                                    <ArrowRight size={18} className="btn-arrow" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="register-footer">
                        <p className="signin-prompt">
                            Already have an account? <Link to="/login" className="link-highlight">Sign In</Link>
                        </p>
                        <Link to="/" className="back-home-link">
                            <ArrowLeft size={15} />
                            <span>Back to home</span>
                        </Link>
                    </div>
                </div>

                <div className="portal-footer">
                    <p>&copy; {new Date().getFullYear()} Yaale Technologies. All rights reserved.</p>
                </div>
            </div>

            <style>{`
                .register-page {
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

                .register-wrapper {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 460px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .register-card {
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
                }

                .register-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    margin-bottom: 24px;
                }

                .brand-logo-container {
                    width: 72px;
                    height: 72px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #f0f8f8 0%, #ffffff 100%);
                    border: 1px solid #d4ecec;
                    border-radius: 18px;
                    padding: 8px;
                    margin-bottom: 14px;
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

                .register-title {
                    font-size: 24px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.025em;
                    margin: 0 0 6px 0;
                }

                .register-subtitle {
                    font-size: 14px;
                    color: #64748b;
                    margin: 0;
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
                }

                .error-icon {
                    color: #dc2626;
                    flex-shrink: 0;
                    margin-top: 1px;
                }

                .register-form {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .input-field-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
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
                }

                .input-control input {
                    width: 100%;
                    height: 44px;
                    padding: 0 42px 0 42px;
                    background: #ffffff;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 14px;
                    color: #0f172a;
                    outline: none;
                    transition: all 0.2s;
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
                }

                .password-toggle-btn:hover {
                    color: #475569;
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
                    margin-top: 8px;
                }

                .btn-submit:hover:not(:disabled) {
                    background: linear-gradient(135deg, #008282 0%, #006060 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 12px 20px -4px rgba(0, 115, 115, 0.45);
                }

                .btn-submit:disabled {
                    opacity: 0.75;
                    cursor: not-allowed;
                }

                .register-footer {
                    margin-top: 24px;
                    padding-top: 18px;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .signin-prompt {
                    font-size: 13.5px;
                    color: #64748b;
                    margin: 0;
                }

                .link-highlight {
                    color: #007373;
                    font-weight: 700;
                    text-decoration: none;
                }

                .link-highlight:hover {
                    text-decoration: underline;
                }

                .back-home-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #94a3b8;
                    text-decoration: none;
                    font-size: 13px;
                    font-weight: 500;
                }

                .back-home-link:hover {
                    color: #007373;
                }

                .portal-footer {
                    margin-top: 20px;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 12px;
                }
            `}</style>
        </div>
    );
};

export default Register;
