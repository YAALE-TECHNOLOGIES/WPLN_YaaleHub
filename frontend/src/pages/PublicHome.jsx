import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, ArrowRight, BookOpen, Mic, Headset, 
  PenTool, FileText, Hash, ChevronRight, CheckCircle,
  Globe, Shield, Award, User, LogOut
} from 'lucide-react';
import Logo from '../assets/Logo.svg';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const PublicHome = () => {
    const { user, logout } = useAuth();
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [attempts, setAttempts] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchModulesAndAttempts = async () => {
            try {
                // Public endpoint for modules
                const [modRes, attRes] = await Promise.all([
                    api.get('/candidate/all-modules'),
                    user ? api.get('/candidate/my-attempts') : Promise.resolve({ data: [] })
                ]);
                console.log('DEBUG - Modules:', modRes.data);
                console.log('DEBUG - User:', user);
                console.log('DEBUG - Attempts:', attRes.data);
                setModules(modRes.data);
                setAttempts(attRes.data);
            } catch (err) {
                console.error('Failed to fetch data', err);
                setError('Unable to load assessment modules. Please check if the backend server is running.');
            } finally {
                setLoading(false);
            }
        };
        fetchModulesAndAttempts();
    }, [user]);

    const getLatestAttempt = (moduleId) => {
        const moduleAttempts = attempts
            .filter(a => String(a.module_id) === String(moduleId))
            .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
        return moduleAttempts[0] || null;
    };

    const getAttemptState = (moduleId) => {
        const latestAttempt = getLatestAttempt(moduleId);
        if (!latestAttempt) return { label: 'Attend Test', className: 'btn-primary', disabled: false, status: null };
        if (latestAttempt.status === 'COMPLETED') {
            return { label: 'Completed', className: 'btn-completed', disabled: true, status: 'completed' };
        }
        if (latestAttempt.status === 'IN_PROGRESS') {
            return { label: 'Attempted', className: 'btn-attempted', disabled: true, status: 'attempted' };
        }
        return { label: 'Attend Test', className: 'btn-primary', disabled: false, status: null };
    };

    const getModuleIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('speaking')) return <Mic size={32} />;
        if (n.includes('listening')) return <Headset size={32} />;
        if (n.includes('writing')) return <PenTool size={32} />;
        if (n.includes('reading')) return <BookOpen size={32} />;
        if (n.includes('grammar')) return <FileText size={32} />;
        if (n.includes('numeracy')) return <Hash size={32} />;
        return <FileText size={32} />;
    };

    return (
        <div className="public-home">
            <nav className="navbar glass">
                <div className="container nav-content">
                    <div className="logo">
                        <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
                        <div className="brand-title-wrap">
                            <span className="logo-text">Skill Bridge</span>
                            <span className="logo-byline">A Product of Yaale Technologies</span>
                        </div>
                    </div>
                    <div className="nav-actions" style={{display: 'flex', gap: '16px', alignItems: 'center'}}>
                        <button 
                            onClick={() => navigate('/dashboard')} 
                            className="btn-results-menu"
                            title="View Your Results"
                        >
                            <Award size={18} /> My Results
                        </button>

                        <button 
                            onClick={() => navigate('/syllabus')} 
                            className="btn-results-menu"
                            title="View Syllabus"
                        >
                            <BookOpen size={18} /> Syllabus
                        </button>
                        
                        {user ? (
                            <>
                                <div className="user-profile">
                                    <div className="user-avatar"><User size={20} /></div>
                                    <div className="user-info">
                                        <p className="user-name">{user?.fullname}</p>
                                        <p className="user-role">Candidate ID: {user?.id}</p>
                                    </div>
                                </div>
                                <button onClick={() => { logout(); navigate('/'); }} className="logout-btn" title="Logout">
                                    <LogOut size={22} color="#64748b" />
                                </button>
                            </>
                        ) : (
                            <button onClick={() => navigate('/login')} className="btn-login" title="Login / Register">
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <header className="hero">
                <div className="container">
                    <h1 className="fade-in">Master Your Skills with <span className="text-gradient">Skill Bridge Program</span></h1>
                    <p className="fade-in">Comprehensive assessments designed to evaluate and certify your proficiency across core language and numeracy modules.</p>
                </div>
            </header>

            <section className="modules-section">
                <div className="container">
                    <div className="section-header">
                        <h2>Available Assessments</h2>
                        <p>Explore our dynamically configured test modules. Click Attend to start your evaluation.</p>
                        {error && <div className="error-banner">{error}</div>}
                    </div>

                    {loading ? (
                        <div className="loading-grid">
                            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-card" />)}
                        </div>
                    ) : (
                        <div className="module-grid">
                            {modules.map(mod => {
                                const attempt = getLatestAttempt(mod.id);
                                const attemptState = getAttemptState(mod.id);
                                const isDone = attemptState.status === 'completed';
                                const isAttempted = attemptState.status === 'attempted';
                                
                                return (
                                    <div key={mod.id} className={`module-card card fade-in ${isDone ? 'completed' : ''} ${isAttempted ? 'attempted' : ''}`}>
                                        <div className="card-icon">
                                            {getModuleIcon(mod.name)}
                                        </div>
                                        <div className="card-body">
                                            <h3>{mod.name}</h3>
                                            <p className="description">{mod.description || 'Generic assessment module designed to test your proficiency in this area.'}</p>
                                            <div className="meta">
                                                <span className="duration"><Clock size={16} /> {mod.duration_minutes} Minutes</span>
                                                {isDone && <span className="status-done"><CheckCircle size={14} /> Completed</span>}
                                                {isAttempted && <span className="status-attempted"><Clock size={14} /> Attempted</span>}
                                            </div>
                                        </div>
                                        <button 
                                            className={`attend-btn ${attemptState.className}`}
                                            onClick={() => {
                                                if (!attemptState.disabled) {
                                                    navigate(`/test-start/${mod.id}`);
                                                }
                                            }}
                                            disabled={attemptState.disabled}
                                        >
                                            {attemptState.label} {isDone ? <CheckCircle size={18} /> : isAttempted ? <Clock size={18} /> : <ArrowRight size={18} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            <footer className="footer">
                <div className="container">
                    <p>&copy; {new Date().getFullYear()} Skill Bridge Assessment Platform &bull; A Product of Yaale Technologies. All rights reserved.</p>
                </div>
            </footer>

            <style>{`
                .public-home { background: #f8fafc; color: #1e293b; min-height: 100vh; }
                .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
                .navbar { position: fixed; top: 0; left: 0; right: 0; height: 80px; z-index: 1000; background: rgba(255,255,255,0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.05); }
                .nav-content { display: flex; align-items: center; justify-content: space-between; height: 100%; }
                .logo { display: flex; align-items: center; gap: 14px; text-decoration: none; }
                .brand-logo { width: 52px; height: auto; display: block; object-fit: contain; }
                .brand-title-wrap { display: flex; flex-direction: column; align-items: flex-start; }
                .logo-text { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2; }
                .logo-byline { font-size: 11px; font-weight: 700; color: #007373; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px; }
                .btn-login { padding: 10px 24px; background: #007373; color: white; display: flex; align-items: center; justify-content: center; border-radius: 12px; transition: all 0.2s; border: none; cursor: pointer; font-weight: 700; font-size: 14px; }
                .btn-login:hover { background: #005959; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 115, 115, 0.2); }
                
                .btn-results-menu { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; color: #1e293b; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 14px; }
                .btn-results-menu:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }

                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding-right: 24px;
                    border-right: 1px solid #e2e8f0;
                    text-align: left;
                }
                .user-avatar {
                    width: 36px;
                    height: 36px;
                    background: #e2e8f0;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .user-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: #0f172a;
                    margin: 0;
                    line-height: 1.2;
                }
                .user-role {
                    font-size: 12px;
                    color: #64748b;
                    margin: 2px 0 0;
                    line-height: 1;
                }
                .logout-btn {
                    background: none;
                    border: none;
                    color: #64748b;
                    opacity: 0.6;
                    transition: all 0.2s;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    padding: 8px;
                    border-radius: 8px;
                }
                .logout-btn:hover {
                    opacity: 1;
                    color: #ef4444;
                    background: #fee2e2;
                }

                @media (max-width: 640px) {
                    .user-info { display: none; }
                    .user-profile { padding-right: 12px; }
                    .logo span { display: none; }
                    .nav-actions { gap: 10px; }
                    .btn-results-menu span { display: none; }
                    .btn-results-menu { padding: 10px; }
                }

                .hero { padding: 180px 0 100px; text-align: center; background: radial-gradient(circle at top right, #eaf5f5, transparent), radial-gradient(circle at bottom left, #f5f3ff, transparent); }
                .hero h1 { font-size: 64px; font-weight: 900; line-height: 1.1; margin-bottom: 24px; }
                .text-gradient { background: linear-gradient(90deg, #007373, #20a39e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .hero p { font-size: 20px; color: #64748b; max-width: 700px; margin: 0 auto; line-height: 1.6; }
                
                .modules-section { padding: 100px 0; }
                .section-header { text-align: center; margin-bottom: 60px; }
                .section-header h2 { font-size: 36px; font-weight: 800; margin-bottom: 16px; }
                .section-header p { color: #64748b; }
                .error-banner { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-top: 16px; font-weight: 600; font-size: 14px; }
                
                .module-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 32px; }
                .module-card { display: flex; flex-direction: column; padding: 32px; height: 100%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(0,0,0,0.03); }
                .module-card:hover { transform: translateY(-8px); border-color: #007373; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.08); }
                .card-icon { width: 64px; height: 64px; background: #eaf5f5; color: #007373; display: flex; align-items: center; justify-content: center; border-radius: 16px; margin-bottom: 24px; }
                .card-body h3 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
                .description { color: #64748b; font-size: 15px; line-height: 1.5; margin-bottom: 24px; min-height: 45px; }
                .meta { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; }
                .duration, .marks { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #475569; }
                .status-done { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #10b981; background: #f0fdf4; padding: 4px 10px; border-radius: 20px; }
                .status-attempted { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #d97706; background: #fffbeb; padding: 4px 10px; border-radius: 20px; }
                
                .attend-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px; margin-top: auto; border: none; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; }
                .btn-primary { background: #007373; color: white; }
                .btn-primary:hover { background: #005959; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 115, 115, 0.2); }
                .btn-completed { background: #f0fdf4; color: #10b981; border: 1px solid #dcfce7; }
                .btn-completed:hover { background: #10b981; color: white; }
                .btn-attempted { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
                .attend-btn:disabled { cursor: not-allowed; opacity: 1; transform: none; box-shadow: none; }
                
                .module-card.completed { border-color: #10b981; background: linear-gradient(to bottom right, #ffffff, #f0fdf4); }
                .module-card.completed .card-icon { background: #10b981; color: white; }
                .module-card.attempted { border-color: #f59e0b; background: linear-gradient(to bottom right, #ffffff, #fffbeb); }
                .module-card.attempted .card-icon { background: #fef3c7; color: #d97706; }
                
                .footer { padding: 40px 0; border-top: 1px solid #e2e8f0; color: #64748b; text-align: center; font-size: 14px; }
                
                .skeleton-card { height: 400px; background: #f1f5f9; border-radius: 24px; position: relative; overflow: hidden; }
                .skeleton-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 1.5s infinite; }
                @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            `}</style>
        </div>
    );
};

export default PublicHome;
