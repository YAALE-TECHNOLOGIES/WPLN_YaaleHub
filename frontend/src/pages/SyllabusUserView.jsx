import React, { useState, useEffect } from 'react';
import { 
  FileText, ExternalLink, Download, Search, 
  Loader2, BookOpen, Clock, ChevronLeft, User, LogOut, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Logo from '../assets/Logo.svg';
import api, { BASE_URL } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SyllabusUserView = () => {
    const [loading, setLoading] = useState(true);
    const [syllabusList, setSyllabusList] = useState([]);
    const [search, setSearch] = useState('');
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        fetchSyllabus();
    }, []);

    const fetchSyllabus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/candidate/syllabus');
            setSyllabusList(res.data);
        } catch (err) {
            showToast('Failed to load syllabus', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredList = syllabusList.filter(s => 
        s.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="syllabus-view-wrapper fade-in">
            <header className="header glass">
                <div className="logo-group">
                    <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
                    <div className="brand-title-wrap">
                        <span className="logo-text">Skill Bridge</span>
                        <span className="logo-byline">A Product of Yaale Technologies</span>
                    </div>
                </div>
                <div className="user-nav">
                    <button onClick={() => navigate('/')} className="home-btn">
                        <Home size={20} />
                        <span>Home</span>
                    </button>
                    <div className="user-profile">
                        <div className="user-avatar"><User size={20} /></div>
                        <div className="user-info">
                            <p className="user-name">{user?.fullname}</p>
                            <p className="user-role">Candidate</p>
                        </div>
                    </div>
                    <button onClick={logout} className="logout-btn">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            <main className="container">
                <div className="page-header">
                    <div className="header-text">
                        <h2>Learning Syllabus</h2>
                        <p>Access your curriculum and learning materials below.</p>
                    </div>
                    <div className="search-box">
                        <Search size={18} />
                        <input 
                            placeholder="Find a document..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loader-container">
                        <Loader2 className="animate-spin text-primary" size={40} />
                        <p>Curating your syllabus...</p>
                    </div>
                ) : (
                    <motion.div 
                        layout
                        className="syllabus-grid"
                    >
                        <AnimatePresence>
                            {filteredList.map((item, idx) => (
                                <motion.div 
                                    key={item.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="syllabus-card card"
                                >
                                    <div className="card-accent"></div>
                                    <div className="card-icon-area">
                                        <div className={`icon-box ${item.file_type?.includes('pdf') ? 'pdf' : 'word'}`}>
                                            {item.file_type?.includes('pdf') ? <FileText size={28} /> : <BookOpen size={28} />}
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        <h3>{item.title}</h3>
                                        <div className="meta">
                                            <span className="type-badge">
                                                {item.file_type?.includes('pdf') ? 'PDF Document' : 'Word Document'}
                                            </span>
                                            <span className="date">
                                                <Clock size={12} /> {new Date(item.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <motion.button 
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={async () => {
                                                try {
                                                    showToast(`Starting download: ${item.title}`, 'info');
                                                    const response = await fetch(`${BASE_URL}/${item.file_path}`);
                                                    if (!response.ok) throw new Error('Network response was not ok');
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    
                                                    // Get extension from path
                                                    const ext = item.file_path.substring(item.file_path.lastIndexOf('.'));
                                                    link.setAttribute('download', `${item.title}${ext}`);
                                                    
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    link.remove();
                                                    window.URL.revokeObjectURL(url);
                                                } catch (err) {
                                                    console.error('Download failed:', err);
                                                    showToast('Opening in new tab...', 'info');
                                                    window.open(`${BASE_URL}/${item.file_path}`, '_blank');
                                                }
                                            }}
                                            className="btn-download"
                                            style={{ border: 'none', cursor: 'pointer', outline: 'none' }}
                                        >
                                            <Download size={18} /> Download
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}

                {!loading && filteredList.length === 0 && (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <BookOpen size={64} opacity={0.1} />
                        </div>
                        <h3>No documents available</h3>
                        <p>Your curriculum documents will appear here once uploaded by the administrator.</p>
                    </div>
                )}
            </main>

            <style>{`
                .syllabus-view-wrapper { min-height: 100vh; background: #f8fafc; }
                .header { position: sticky; top: 0; z-index: 100; height: 80px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; }
                .logo-group { display: flex; align-items: center; gap: 14px; }
                .brand-logo { width: 52px; height: auto; display: block; object-fit: contain; }
                .brand-title-wrap { display: flex; flex-direction: column; align-items: flex-start; }
                .logo-text { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2; }
                .logo-byline { font-size: 11px; font-weight: 700; color: #007373; letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px; }
                .user-nav { display: flex; align-items: center; gap: 24px; }
                .user-profile { display: flex; align-items: center; gap: 12px; padding-right: 24px; border-right: 1px solid #e2e8f0; }
                .user-avatar { width: 40px; height: 40px; background: #e2e8f0; color: #64748b; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
                .user-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
                .user-role { font-size: 12px; color: #64748b; }
                .home-btn { display: flex; align-items: center; gap: 8px; background: #f1f5f9; color: #475569; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; }
                .logout-btn { background: none; color: #64748b; opacity: 0.6; }
                .logout-btn:hover { opacity: 1; color: #ef4444; }

                .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
                .header-text h2 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
                .header-text p { color: #64748b; }
                .search-box { display: flex; align-items: center; gap: 12px; background: white; padding: 0 16px; border-radius: 12px; border: 1px solid #e2e8f0; width: 300px; }
                .search-box input { border: none; padding: 12px 0; outline: none; width: 100%; font-size: 14px; }

                .syllabus-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
                .syllabus-card { position: relative; display: flex; flex-direction: column; padding: 32px; background: white; border-radius: 20px; transition: all 0.3s; overflow: hidden; border: 1px solid #e2e8f0; }
                .syllabus-card:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); }
                .card-accent { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #007373, #20a39e); opacity: 0; transition: opacity 0.3s; }
                .syllabus-card:hover .card-accent { opacity: 1; }
                
                .card-icon-area { margin-bottom: 24px; }
                .icon-box { width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
                .icon-box.pdf { background: #fef2f2; color: #ef4444; }
                .icon-box.word { background: #eaf5f5; color: #007373; }

                .card-content h3 { font-size: 18px; font-weight: 800; margin-bottom: 12px; color: #1e293b; line-height: 1.4; }
                .meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
                .type-badge { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
                .date { font-size: 12px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }

                .card-actions { margin-top: auto; }
                .btn-download { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 12px; background: #f1f5f9; color: #1e293b; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; transition: all 0.2s; }
                .btn-download:hover { background: #007373; color: white; }

                .loader-container { padding: 100px 0; text-align: center; color: #64748b; }
                .empty-state { padding: 80px 0; text-align: center; color: #64748b; }
                .empty-icon { margin-bottom: 20px; }
            `}</style>
        </div>
    );
};

export default SyllabusUserView;
