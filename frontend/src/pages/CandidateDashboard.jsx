import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Mic, Headset, PenTool, BookOpen, FileText, Hash, 
  CheckCircle2, Clock, Play, LogOut, ChevronRight, User, Award, Home, Zap
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Logo from '../assets/Logo.svg';
import api from '../api/api';

const CandidateDashboard = () => {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [modRes, attRes] = await Promise.all([
        api.get('/candidate/modules'),
        api.get('/candidate/my-attempts')
      ]);
      setModules(modRes.data);
      setAttempts(attRes.data);
      console.log('DEBUG - Attempts Data:', attRes.data);
      console.log('DEBUG - Modules Data:', modRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startTest = async (moduleId) => {
    try {
      // Unlock audio & speech synthesis on the exact user click event
      window.speechSynthesis.cancel();
      const silentUtterance = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(silentUtterance);
      
      // We can also create a silent audio element to unlock HTML5 Audio if needed
      const audioRes = new Audio("data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
      audioRes.play().catch(() => {});

      const res = await api.post(`/candidate/start-test/${moduleId}`);
      navigate(`/test/${moduleId}/${res.data.id}`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to start test', 'error');
    }
  };

  const getLatestAttempt = (moduleId) => {
    const moduleAttempts = attempts
      .filter(a => String(a.module_id) === String(moduleId))
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return moduleAttempts[0] || null;
  };

  const getStatus = (moduleId) => {
    const attempt = getLatestAttempt(moduleId);
    if (!attempt) return { text: 'Not Attempted', color: '#64748b', icon: null };
    if (attempt.status === 'COMPLETED') return { text: 'Completed', color: '#10b981', icon: <CheckCircle2 size={16} />, variant: 'completed' };
    if (attempt.status === 'IN_PROGRESS') return { text: 'Attempted', color: '#d97706', icon: <Clock size={16} />, variant: 'attempted' };
    return { text: 'Not Attempted', color: '#64748b', icon: null };
  };

  const getModuleIcon = (name) => {
    switch (name.toLowerCase()) {
      case 'speaking': return <Mic />;
      case 'listening': return <Headset />;
      case 'writing': return <PenTool />;
      case 'reading': return <BookOpen />;
      case 'grammar & vocabulary': return <FileText />;
      case 'numeracy': return <Hash />;
      default: return <FileText />;
    }
  };





  return (
    <div className="dashboard-wrapper fade-in">
      <header className="header glass fade-in">
        <div className="logo-group">
          <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
          <div className="brand-title-wrap">
            <span className="logo-text">Skill Bridge</span>
            <span className="logo-byline">A Product of Yaale Technologies</span>
          </div>
        </div>
        <div className="user-nav">
          <button onClick={() => navigate('/')} className="home-btn" title="Back to Home">
             <Home size={20} />
             <span>Home</span>
          </button>
          <button onClick={() => navigate('/syllabus')} className="home-btn" title="View Syllabus">
             <BookOpen size={20} />
             <span>Syllabus</span>
          </button>
          <div className="user-profile">
            <div className="user-avatar"><User size={20} /></div>
            <div className="user-info">
              <p className="user-name">{user?.fullname}</p>
              <p className="user-role">Candidate ID: {user?.id}</p>
            </div>
          </div>
          <button onClick={logout} className="logout-btn">
             <LogOut size={20} />
          </button>
        </div>
      </header>
      
      <main className="container dashboard">
        <div className="dashboard-intro">
          <h2>Assessment Center</h2>
        </div>




        
        <div className="module-grid">
          {modules.map((m) => {
            const attempt = getLatestAttempt(m.id);
            const status = getStatus(m.id);
            const isCompleted = status.text === 'Completed';
            const isAttempted = status.text === 'Attempted';
            const isLocked = isCompleted || isAttempted;
            
            // Find matched proficiency level
            let matchedLevel = 'N/A';
            if (attempt && attempt.status === 'COMPLETED' && m.proficiency_mapping && Array.isArray(m.proficiency_mapping)) {
              const attemptScore = parseFloat(attempt.total_score || 0);
              for (const rule of m.proficiency_mapping) {
                const min = parseFloat(rule.min);
                const max = parseFloat(rule.max);
                if (!isNaN(min) && !isNaN(max) && attemptScore >= min && attemptScore <= max) {
                  matchedLevel = rule.level;
                  break;
                }
              }
            }

            return (
              <div key={m.id} className={`result-card card ${isCompleted ? 'completed' : ''} ${isAttempted ? 'attempted' : ''}`}>
                <div className="card-header">
                   <div className="mod-info">
                       <div className="mod-icon-box">{getModuleIcon(m.name)}</div>
                       <h3 className="mod-name-title">{m.name}</h3>
                   </div>
                </div>

                <div className="card-body">
                   {isCompleted ? (
                       <div className="result-details">
                           <div className="bc-card-stats">
                               <div className="bc-stat-row">
                                   <span className="bc-stat-label">Skill Score</span>
                                   <span className="bc-stat-value">{parseFloat(attempt.total_score || 0)}/{parseFloat(attempt.total_possible || 0)}</span>
                               </div>
                               <div className="bc-stat-row">
                                   <span className="bc-stat-label">Level</span>
                                   <span className="bc-stat-level">{matchedLevel}</span>
                               </div>
                           </div>
                       </div>
                  ) : isAttempted ? (
                      <div className="unattempted-state">
                          <div className="state-meta attempted-meta">
                             <span style={{color: status.color, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '14px'}}>
                                 {status.icon} Attempted (Not Submitted)
                             </span>
                             <span style={{color: '#92400e', fontSize: '13px', fontWeight: '600'}}>
                                 Submission pending
                             </span>
                          </div>
                          <div className="attempted-note">
                            This test has already been started. Re-attempt is not allowed.
                          </div>
                      </div>
                   ) : (
                       <div className="unattempted-state">
                           <div className="state-meta">
                              <span style={{color: status.color, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '14px'}}>
                                  {status.icon} {status.text}
                              </span>
                              <span style={{color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                  <Clock size={14}/> {m.duration_minutes} Minutes
                              </span>
                           </div>
                            {!isLocked && (
                              <button 
                                onClick={() => {
                                  if (m.question_count > 0) {
                                    startTest(m.id);
                                  }
                                }}
                                className="btn-start-test"
                                disabled={m.question_count === 0}
                                style={m.question_count === 0 ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                              >
                                <><Play size={18} fill="currentColor" /> {m.question_count === 0 ? 'Unavailable in Set' : 'Start Test'}</>
                              </button>
                            )}
                       </div>
                   )}
                </div>
              </div>
            );

          })}
        </div>
      </main>

      <style>{`
        .start-btn.view-result {
          background: #f0fdf4;
          color: #16a34a;
          border-color: #dcfce7;
        }
        .start-btn.view-result:hover {
          background: #16a34a;
          color: white;
          border-color: #16a34a;
        }
`}</style>

      <style>{`
        .dashboard-wrapper {
          min-height: 100vh;
        }
        
         .prof-info-empty {
            color: #94a3b8;
            font-size: 14px;
            font-style: italic;
            margin-bottom: 24px;
         }

         .bc-card-stats {
             display: flex;
             flex-direction: column;
             gap: 0;
             border: 1px solid #e2e8f0;
             border-radius: 12px;
             overflow: hidden;
         }
         .bc-stat-row {
             display: flex;
             justify-content: space-between;
             align-items: center;
             padding: 16px 20px;
             border-bottom: 1px solid #e2e8f0;
         }
         .bc-stat-row:last-child {
             border-bottom: none;
         }
         .bc-stat-label {
             font-size: 14px;
             font-weight: 700;
             color: #475569;
         }
         .bc-stat-value {
             font-size: 18px;
             font-weight: 800;
             color: #0f172a;
         }
         .bc-stat-level {
             font-size: 20px;
             font-weight: 900;
             color: #1e293b;
         }

        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
        }
        .logo-group {
          display: flex;
          align-items: center;
          gap: 14px;
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
        .user-nav {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-right: 24px;
          border-right: 1px solid var(--border);
        }
        .user-avatar {
          width: 40px;
          height: 40px;
          background: #e2e8f0;
          color: var(--secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .user-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text-main);
          margin-bottom: 2px;
        }
        .user-role {
          font-size: 12px;
          color: var(--secondary);
        }
        .home-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          color: #475569;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .home-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .logout-btn {
          background: none;
          color: var(--secondary);
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .logout-btn:hover {
          opacity: 1;
          color: var(--danger);
        }
        .container {
           max-width: 1200px;
           margin: 40px auto;
           padding: 0 20px;
        }
        .dashboard-intro {
          margin-bottom: 32px;
        }
        .dashboard-intro h2 {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .dashboard-intro p {
          color: var(--text-soft);
        }
        .module-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 24px;
        }
        .result-card {
           display: flex;
           flex-direction: column;
           padding: 24px;
           background: white;
           border: 1px solid #e2e8f0;
           border-radius: 16px;
           transition: all 0.3s;
        }
        .result-card:hover {
           transform: translateY(-4px);
           box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
           border-color: #cbd5e1;
        }
        .result-card.completed {
           border-color: #b8dede;
        }
        .result-card.attempted {
           border-color: #fcd34d;
           background: linear-gradient(to bottom right, #ffffff, #fffbeb);
        }
        .card-header {
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           margin-bottom: 24px;
           padding-bottom: 16px;
           border-bottom: 1px solid #f1f5f9;
        }
        .mod-info {
           display: flex;
           align-items: center;
           gap: 12px;
        }
        .mod-icon-box {
          width: 48px;
          height: 48px;
          background: #f1f5f9;
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }
        .result-card.completed .mod-icon-box {
          background: #eaf5f5;
        }
        .result-card.attempted .mod-icon-box {
          background: #fef3c7;
          color: #d97706;
        }
        .mod-name-title {
           font-size: 18px;
           font-weight: 800;
           color: #0f172a;
        }
        .score-badge {
           display: flex;
           align-items: center;
           gap: 6px;
           background: #eaf5f5;
           color: #007373;
           font-weight: 800;
           padding: 6px 12px;
           border-radius: 8px;
           font-size: 15px;
        }
        .card-body {
           flex: 1;
           display: flex;
           flex-direction: column;
        }
        .result-details {
           flex: 1;
           display: flex;
           flex-direction: column;
        }
        .prof-info {
           margin-bottom: 24px;
        }
        .prof-badges {
           display: flex;
           gap: 12px;
           margin-bottom: 16px;
           align-items: center;
        }
        .prof-level {
           font-size: 20px;
           font-weight: 900;
           color: #0f172a;
        }
        .prof-cefr {
           font-size: 12px;
           font-weight: 800;
           color: #6366f1;
           background: #cceeee;
           padding: 4px 10px;
           border-radius: 6px;
        }
        .prof-desc {
           font-size: 14px;
           color: #475569;
           line-height: 1.5;
        }
        .prof-desc strong {
           display: block;
           font-size: 12px;
           text-transform: uppercase;
           color: #94a3b8;
           margin-bottom: 4px;
           letter-spacing: 0.5px;
        }
        .progress-container {
           margin-top: auto;
           background: #f8fafc;
           padding: 16px;
           border-radius: 12px;
        }
        .progress-bar-bg {
           height: 8px;
           background: #e2e8f0;
           border-radius: 4px;
           overflow: hidden;
           margin-bottom: 8px;
        }
        .progress-bar-fill {
           height: 100%;
           background: linear-gradient(90deg, #007373, #20a39e);
           border-radius: 4px;
           transition: width 1s ease-out;
        }
        .progress-text {
           font-size: 12px;
           font-weight: 700;
           color: #64748b;
        }
        .unattempted-state {
           display: flex;
           flex-direction: column;
           gap: 24px;
           height: 100%;
           justify-content: center;
        }
        .state-meta {
           display: flex;
           justify-content: space-between;
           align-items: center;
           background: #f8fafc;
           padding: 16px;
           border-radius: 12px;
           border: 1px dashed #cbd5e1;
        }
        .state-meta.attempted-meta {
           background: #fffbeb;
           border-color: #fcd34d;
        }
        .attempted-note {
           padding: 14px 16px;
           border-radius: 12px;
           background: #fff7ed;
           border: 1px solid #fed7aa;
           color: #9a3412;
           font-size: 14px;
           font-weight: 600;
           line-height: 1.5;
        }
        .btn-start-test {
           display: flex;
           align-items: center;
           justify-content: center;
           gap: 10px;
           background: #007373;
           color: white;
           padding: 14px;
           border: none;
           border-radius: 12px;
           font-weight: 700;
           font-size: 15px;
           cursor: pointer;
           transition: all 0.2s;
           box-shadow: 0 4px 6px -1px rgba(0, 115, 115, 0.2);
        }
        .btn-start-test:hover {
           background: #005959;
           transform: translateY(-2px);
           box-shadow: 0 10px 15px -3px rgba(0, 115, 115, 0.3);
        }
        .prof-info-empty {
           color: #94a3b8;
           font-size: 14px;
           font-style: italic;
           margin-bottom: 24px;
        }

        .quantitative-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
        }
        .stat-item {
            background: #f8fafc;
            padding: 12px;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .stat-item .s-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .stat-item .s-val {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
        }
        .btn-view-report {
            width: 100%;
            margin-top: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px;
            background: white;
            border: 1px solid #e2e8f0;
            color: #007373;
            font-weight: 700;
            font-size: 14px;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-view-report:hover {
            background: #f8fafc;
            border-color: #007373;
            transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
};

export default CandidateDashboard;
