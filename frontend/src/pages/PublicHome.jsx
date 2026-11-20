import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, ArrowRight, BookOpen, Mic, Headset, 
  PenTool, FileText, Hash, CheckCircle,
  Award, User, LogOut, Sparkles, ChevronRight, ShieldCheck
} from 'lucide-react';
import Logo from '../assets/Logo.svg';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const MODULE_PRESETS = {
  speaking: {
    tag: 'Oral & Phonetics',
    desc: 'Oral fluency, pronunciation precision & situational dialogue response.'
  },
  listening: {
    tag: 'Audio Comprehension',
    desc: 'Dialogue retention, contextual inference & real-time detail decoding.'
  },
  writing: {
    tag: 'Business Composition',
    desc: 'Structured expression, syntax mastery & communicative written clarity.'
  },
  reading: {
    tag: 'Text Analysis',
    desc: 'Critical reading, passage analysis & rapid vocabulary interpretation.'
  },
  'grammar & vocabulary': {
    tag: 'Lexical Mechanics',
    desc: 'Sentence mechanics, applied grammatical structure & lexical precision.'
  },
  numeracy: {
    tag: 'Quantitative Logic',
    desc: 'Workplace mathematical reasoning, numerical interpretation & problem solving.'
  }
};

const PublicHome = () => {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [modRes, attRes] = await Promise.all([
          api.get('/candidate/all-modules'),
          user ? api.get('/candidate/my-attempts') : Promise.resolve({ data: [] })
        ]);
        setModules(modRes.data);
        setAttempts(attRes.data);
      } catch (err) {
        console.error('Failed to fetch data', err);
        setError('Unable to load assessment modules. Please check connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const getLatestAttempt = (moduleId) => {
    const moduleAttempts = attempts
      .filter(a => String(a.module_id) === String(moduleId))
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return moduleAttempts[0] || null;
  };

  const getAttemptState = (moduleId) => {
    const latest = getLatestAttempt(moduleId);
    if (!latest) return { label: 'Start Assessment', className: 'btn-start', disabled: false, status: null };
    if (latest.status === 'COMPLETED') {
      return { label: 'Completed', className: 'btn-completed', disabled: true, status: 'completed' };
    }
    if (latest.status === 'IN_PROGRESS') {
      return { label: 'Resume Test', className: 'btn-resume', disabled: false, status: 'in_progress', attemptId: latest.id };
    }
    return { label: 'Start Assessment', className: 'btn-start', disabled: false, status: null };
  };

  const getModuleMeta = (name) => {
    const key = String(name).toLowerCase().trim();
    for (const [k, v] of Object.entries(MODULE_PRESETS)) {
      if (key.includes(k)) return v;
    }
    return {
      tag: 'Core Discipline',
      desc: 'Standardized evaluation module mapping literacy and functional aptitude.'
    };
  };

  const getModuleIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('speaking')) return <Mic size={24} strokeWidth={2.2} />;
    if (n.includes('listening')) return <Headset size={24} strokeWidth={2.2} />;
    if (n.includes('writing')) return <PenTool size={24} strokeWidth={2.2} />;
    if (n.includes('reading')) return <BookOpen size={24} strokeWidth={2.2} />;
    if (n.includes('grammar')) return <FileText size={24} strokeWidth={2.2} />;
    if (n.includes('numeracy')) return <Hash size={24} strokeWidth={2.2} />;
    return <FileText size={24} strokeWidth={2.2} />;
  };

  return (
    <div className="yaale-page">
      {/* Subtle Ambient Radial Lighting */}
      <div className="ambient-teal-glow" />
      <div className="subtle-grid" />

      {/* Clean Frosted Header */}
      <header className="yaale-header">
        <div className="yaale-container header-row">
          <div className="brand-lockup" onClick={() => navigate('/')}>
            <div className="logo-shield">
              <img src={Logo} alt="Yaale Technologies" className="logo-img" />
            </div>
            <div className="brand-text">
              <span className="brand-primary">Skill Bridge</span>
              <span className="brand-tagline">A Product of Yaale Technologies</span>
            </div>
          </div>

          <nav className="header-nav">
            <button onClick={() => navigate('/syllabus')} className="nav-btn">
              <BookOpen size={16} /> Syllabus
            </button>
            <button onClick={() => navigate('/dashboard')} className="nav-btn">
              <Award size={16} /> My Results
            </button>

            {user ? (
              <div className="user-capsule">
                <div className="user-icon-circle">
                  <User size={15} />
                </div>
                <div className="user-text-wrap">
                  <span className="user-name-label">{user?.fullname?.split(' ')[0] || 'Candidate'}</span>
                  <span className="user-id-badge">ID #{user?.id}</span>
                </div>
                <button 
                  onClick={() => { logout(); navigate('/'); }} 
                  className="logout-icon-btn" 
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="primary-login-btn">
                Sign In <ChevronRight size={15} />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="yaale-hero">
        <div className="yaale-container hero-center">
          <div className="pre-badge">
            <Sparkles size={14} className="sparkle-teal" />
            <span>WPLN Assessment Standard &bull; Singapore Benchmark</span>
          </div>

          <h1 className="hero-title">
            Workplace Literacy <br />
            <span className="teal-gradient-text">&amp; Numeracy Standard</span>
          </h1>

          <p className="hero-desc">
            Standardized digital evaluations measuring core language competency, contextual reasoning, and quantitative problem solving.
          </p>

          {/* Clean White Stats Capsule */}
          <div className="stats-capsule">
            <div className="stat-unit">
              <span className="stat-number">6</span>
              <span className="stat-caption">Disciplines</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-unit">
              <span className="stat-number">A1 &ndash; C1</span>
              <span className="stat-caption">CEFR Mapped</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-unit">
              <span className="stat-number">100%</span>
              <span className="stat-caption">Automated Scoring</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-unit">
              <span className="stat-number">Official</span>
              <span className="stat-caption">Certification Ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Modules Grid */}
      <main className="modules-block">
        <div className="yaale-container">
          <div className="modules-bar">
            <div>
              <span className="eyebrow-text">STANDARDIZED MODULES</span>
              <h2 className="modules-headline">Available Assessments</h2>
            </div>
            <span className="count-pill">
              {modules.length} Modules Online
            </span>
          </div>

          {error && <div className="error-box">{error}</div>}

          {loading ? (
            <div className="modules-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="skeleton-module" />
              ))}
            </div>
          ) : (
            <div className="modules-grid">
              {modules.map(mod => {
                const meta = getModuleMeta(mod.name);
                const attemptState = getAttemptState(mod.id);
                const isCompleted = attemptState.status === 'completed';
                const isOngoing = attemptState.status === 'in_progress';

                return (
                  <div key={mod.id} className={`assessment-card ${isCompleted ? 'state-completed' : ''}`}>
                    <div className="card-top">
                      <div className="icon-wrapper">
                        {getModuleIcon(mod.name)}
                      </div>
                      <span className="tag-pill">{meta.tag}</span>
                    </div>

                    <div className="card-main">
                      <h3 className="card-heading">{mod.name}</h3>
                      <p className="card-desc">{meta.desc}</p>
                    </div>

                    <div className="card-bottom">
                      <div className="duration-tag">
                        <Clock size={15} />
                        <span>{mod.duration_minutes} Mins</span>
                      </div>

                      <button
                        className={`action-btn ${attemptState.className}`}
                        onClick={() => {
                          if (isOngoing && attemptState.attemptId) {
                            navigate(`/test/${mod.id}/${attemptState.attemptId}`);
                          } else if (!isCompleted) {
                            navigate(`/test-start/${mod.id}`);
                          }
                        }}
                        disabled={isCompleted}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle size={15} /> Completed
                          </>
                        ) : isOngoing ? (
                          <>
                            Resume <ArrowRight size={15} />
                          </>
                        ) : (
                          <>
                            Begin <ArrowRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Clean White & Teal Footer */}
      <footer className="yaale-footer">
        <div className="yaale-container footer-flex">
          <div className="footer-brand-side">
            <span className="brand-bold">Skill Bridge</span>
            <span className="dot-sep">&bull;</span>
            <span>A Product of Yaale Technologies</span>
          </div>
          <div className="footer-copy-side">
            <span>&copy; {new Date().getFullYear()} All Rights Reserved.</span>
          </div>
        </div>
      </footer>

      <style>{`
        /* ─── Clean White & Yaale Teal Palette (#007373) ─── */
        :root {
          --yaale-teal: #007373;
          --yaale-teal-light: #eaf5f5;
          --yaale-teal-border: #b8dede;
          --yaale-teal-hover: #005959;
          --yaale-teal-active: #004040;
          --yaale-navy: #0f172a;
          --yaale-slate: #334155;
          --yaale-muted: #64748b;
          --yaale-border: #e2e8f0;
          --yaale-card-bg: #ffffff;
          --yaale-page-bg: #ffffff;
        }

        .yaale-page {
          background-color: var(--yaale-page-bg);
          color: var(--yaale-navy);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Roboto, sans-serif;
          letter-spacing: -0.01em;
        }

        .yaale-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Ambient Lighting (Clean Teal Wash on White) */
        .ambient-teal-glow {
          position: absolute;
          top: -150px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 480px;
          background: radial-gradient(circle, rgba(0, 115, 115, 0.08) 0%, rgba(234, 245, 245, 0.5) 45%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .subtle-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(0, 115, 115, 0.025) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 115, 115, 0.025) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 65% 50% at 50% 25%, #000 60%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        /* ─── Header ─── */
        .yaale-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--yaale-border);
          height: 76px;
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
        }

        .brand-lockup {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }
        .logo-shield {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid var(--yaale-teal-border);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          box-shadow: 0 2px 8px rgba(0, 115, 115, 0.08);
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .brand-text {
          display: flex;
          flex-direction: column;
        }
        .brand-primary {
          font-size: 18px;
          font-weight: 800;
          color: var(--yaale-navy);
          letter-spacing: -0.025em;
          line-height: 1.15;
        }
        .brand-tagline {
          font-size: 11px;
          font-weight: 700;
          color: var(--yaale-teal);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .header-nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #ffffff;
          border: 1.5px solid var(--yaale-border);
          color: var(--yaale-slate);
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .nav-btn:hover {
          color: var(--yaale-teal);
          border-color: var(--yaale-teal-border);
          background: var(--yaale-teal-light);
        }

        .primary-login-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          background: var(--yaale-teal);
          color: #ffffff;
          border: none;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(0, 115, 115, 0.25);
        }
        .primary-login-btn:hover {
          background: var(--yaale-teal-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(0, 115, 115, 0.35);
        }

        .user-capsule {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 12px 4px 6px;
          border-radius: 999px;
          background: var(--yaale-teal-light);
          border: 1px solid var(--yaale-teal-border);
        }
        .user-icon-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--yaale-teal);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-text-wrap {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .user-name-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--yaale-navy);
        }
        .user-id-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--yaale-teal);
        }
        .logout-icon-btn {
          background: transparent;
          border: none;
          color: var(--yaale-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s ease;
        }
        .logout-icon-btn:hover {
          color: #ef4444;
        }

        /* ─── Hero Section ─── */
        .yaale-hero {
          position: relative;
          z-index: 1;
          padding: 70px 0 50px;
          text-align: center;
        }
        .hero-center {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .pre-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 999px;
          background: var(--yaale-teal-light);
          border: 1px solid var(--yaale-teal-border);
          font-size: 12px;
          font-weight: 700;
          color: var(--yaale-teal);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }
        .sparkle-teal {
          color: var(--yaale-teal);
        }

        .hero-title {
          font-size: 54px;
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.035em;
          margin: 0 0 18px 0;
          color: var(--yaale-navy);
        }
        .teal-gradient-text {
          color: var(--yaale-teal);
          background: linear-gradient(135deg, #007373 0%, #009999 50%, #00b3b3 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-desc {
          font-size: 18px;
          color: var(--yaale-muted);
          max-width: 620px;
          line-height: 1.6;
          margin: 0 0 40px 0;
          font-weight: 400;
        }

        /* Stats Capsule (Clean White Card) */
        .stats-capsule {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid var(--yaale-border);
          border-radius: 999px;
          padding: 14px 36px;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05);
          gap: 32px;
        }
        .stat-unit {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-number {
          font-size: 18px;
          font-weight: 800;
          color: var(--yaale-teal);
          line-height: 1.1;
        }
        .stat-caption {
          font-size: 11px;
          font-weight: 700;
          color: var(--yaale-slate);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 3px;
        }
        .stat-divider {
          width: 1px;
          height: 28px;
          background: var(--yaale-border);
        }

        /* ─── Modules Block ─── */
        .modules-block {
          position: relative;
          z-index: 1;
          padding: 30px 0 90px;
        }
        .modules-bar {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 28px;
          border-bottom: 1.5px solid var(--yaale-border);
          padding-bottom: 16px;
        }
        .eyebrow-text {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: var(--yaale-teal);
          text-transform: uppercase;
        }
        .modules-headline {
          font-size: 26px;
          font-weight: 800;
          color: var(--yaale-navy);
          letter-spacing: -0.02em;
          margin: 4px 0 0 0;
        }
        .count-pill {
          font-size: 13px;
          color: var(--yaale-teal);
          background: var(--yaale-teal-light);
          border: 1px solid var(--yaale-teal-border);
          padding: 4px 12px;
          border-radius: 999px;
          font-weight: 700;
        }

        /* Modules Grid */
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        /* Assessment Card (Clean White & Teal Highlight) */
        .assessment-card {
          background: #ffffff;
          border: 1.5px solid var(--yaale-border);
          border-radius: 18px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .assessment-card:hover {
          border-color: var(--yaale-teal);
          transform: translateY(-4px);
          box-shadow: 0 16px 36px -6px rgba(0, 115, 115, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04);
        }
        .assessment-card.state-completed {
          background: #fbfdfc;
          border-color: #a7f3d0;
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--yaale-teal-light);
          color: var(--yaale-teal);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .assessment-card:hover .icon-wrapper {
          background: var(--yaale-teal);
          color: #ffffff;
          transform: scale(1.05);
        }

        .tag-pill {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.03em;
          padding: 4px 10px;
          border-radius: 999px;
          background: #f1f5f9;
          color: var(--yaale-slate);
        }

        .card-main {
          flex: 1;
          margin-bottom: 24px;
        }
        .card-heading {
          font-size: 20px;
          font-weight: 800;
          color: var(--yaale-navy);
          margin: 0 0 8px 0;
          letter-spacing: -0.015em;
        }
        .card-desc {
          font-size: 14px;
          color: var(--yaale-muted);
          line-height: 1.55;
          margin: 0;
          min-height: 44px;
        }

        .card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }
        .duration-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--yaale-slate);
        }

        /* Action Buttons */
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }
        .btn-start {
          background: var(--yaale-teal);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 115, 115, 0.2);
        }
        .btn-start:hover {
          background: var(--yaale-teal-hover);
          transform: translateX(2px);
          box-shadow: 0 4px 12px rgba(0, 115, 115, 0.35);
        }
        .btn-resume {
          background: #f59e0b;
          color: #ffffff;
        }
        .btn-resume:hover {
          background: #d97706;
          transform: translateX(2px);
        }
        .btn-completed {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
          cursor: default;
        }

        /* Skeletons */
        .skeleton-module {
          height: 220px;
          background: #f8fafc;
          border: 1.5px solid var(--yaale-border);
          border-radius: 18px;
          animation: pulse 1.5s infinite;
        }

        .error-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 24px;
        }

        /* ─── Footer ─── */
        .yaale-footer {
          border-top: 1.5px solid var(--yaale-border);
          padding: 32px 0;
          font-size: 13px;
          color: var(--yaale-muted);
          background: #ffffff;
        }
        .footer-flex {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-brand-side {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-bold {
          font-weight: 800;
          color: var(--yaale-navy);
        }
        .dot-sep {
          color: var(--yaale-border);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-title { font-size: 36px; }
          .hero-desc { font-size: 16px; }
          .stats-capsule { flex-wrap: wrap; border-radius: 20px; gap: 16px; justify-content: center; }
          .stat-divider { display: none; }
          .modules-grid { grid-template-columns: 1fr; }
          .footer-flex { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default PublicHome;
