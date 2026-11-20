import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, ArrowRight, BookOpen, Mic, Headset, 
  PenTool, FileText, Hash, CheckCircle,
  Award, User, LogOut, Sparkles, ShieldCheck, BarChart3, ChevronRight
} from 'lucide-react';
import Logo from '../assets/Logo.svg';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

const MODULE_PRESETS = {
  speaking: {
    tag: 'Oral & Phonetics',
    desc: 'Oral fluency, pronunciation precision & situational dialogue response.',
    accent: '#00A896',
    bg: 'rgba(0, 168, 150, 0.08)'
  },
  listening: {
    tag: 'Audio Comprehension',
    desc: 'Dialogue retention, contextual inference & real-time detail decoding.',
    accent: '#028090',
    bg: 'rgba(2, 128, 144, 0.08)'
  },
  writing: {
    tag: 'Business Composition',
    desc: 'Structured expression, syntax mastery & communicative written clarity.',
    accent: '#007373',
    bg: 'rgba(0, 115, 115, 0.08)'
  },
  reading: {
    tag: 'Text Analysis',
    desc: 'Critical reading, passage analysis & rapid vocabulary interpretation.',
    accent: '#05668D',
    bg: 'rgba(5, 102, 141, 0.08)'
  },
  'grammar & vocabulary': {
    tag: 'Lexical Mechanics',
    desc: 'Sentence mechanics, applied grammatical structure & lexical precision.',
    accent: '#118AB2',
    bg: 'rgba(17, 138, 178, 0.08)'
  },
  numeracy: {
    tag: 'Quantitative Logic',
    desc: 'Workplace mathematical reasoning, numerical interpretation & problem solving.',
    accent: '#06D6A0',
    bg: 'rgba(6, 214, 160, 0.08)'
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
      desc: 'Standardized evaluation module mapping literacy and functional aptitude.',
      accent: '#007373',
      bg: 'rgba(0, 115, 115, 0.08)'
    };
  };

  const getModuleIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('speaking')) return <Mic size={24} strokeWidth={2} />;
    if (n.includes('listening')) return <Headset size={24} strokeWidth={2} />;
    if (n.includes('writing')) return <PenTool size={24} strokeWidth={2} />;
    if (n.includes('reading')) return <BookOpen size={24} strokeWidth={2} />;
    if (n.includes('grammar')) return <FileText size={24} strokeWidth={2} />;
    if (n.includes('numeracy')) return <Hash size={24} strokeWidth={2} />;
    return <FileText size={24} strokeWidth={2} />;
  };

  return (
    <div className="rich-app">
      {/* Background Ambient Glows */}
      <div className="ambient-glow glow-top" />
      <div className="ambient-glow glow-bottom" />
      <div className="subtle-grid-bg" />

      {/* Luxury Glass Navigation */}
      <header className="rich-header">
        <div className="rich-container nav-row">
          <div className="brand-group" onClick={() => navigate('/')}>
            <div className="logo-box">
              <img src={Logo} alt="Yaale Technologies" className="brand-logo" />
            </div>
            <div className="brand-meta">
              <span className="brand-name">Skill Bridge</span>
              <span className="brand-sub">Yaale Technologies</span>
            </div>
          </div>

          <nav className="nav-actions">
            <button onClick={() => navigate('/syllabus')} className="nav-link-btn">
              <BookOpen size={16} /> Syllabus
            </button>
            <button onClick={() => navigate('/dashboard')} className="nav-link-btn">
              <Award size={16} /> My Results
            </button>

            {user ? (
              <div className="user-pill">
                <div className="avatar-chip">
                  <User size={15} />
                </div>
                <div className="user-name-box">
                  <span className="user-name">{user?.fullname?.split(' ')[0] || 'Candidate'}</span>
                  <span className="user-id">#{user?.id}</span>
                </div>
                <button 
                  onClick={() => { logout(); navigate('/'); }} 
                  className="logout-mini-btn" 
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')} className="rich-login-btn">
                Sign In <ChevronRight size={15} />
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section (Clean, Punchy, Rich Mood) */}
      <section className="rich-hero">
        <div className="rich-container hero-container">
          <div className="hero-pill-badge">
            <Sparkles size={13} className="sparkle-icon" />
            <span>WPLN Assessment Standard &bull; Singapore Benchmark</span>
          </div>

          <h1 className="hero-headline">
            Workplace Literacy <br />
            <span className="emerald-shimmer">&amp; Numeracy Standard</span>
          </h1>

          <p className="hero-subtext">
            Precision assessment platform evaluating core language proficiency, contextual comprehension, and quantitative reasoning.
          </p>

          {/* Quick Metrics Bar */}
          <div className="metrics-strip">
            <div className="metric-item">
              <span className="metric-val">6</span>
              <span className="metric-lbl">Core Disciplines</span>
            </div>
            <div className="metric-div" />
            <div className="metric-item">
              <span className="metric-val">A1 &ndash; C1</span>
              <span className="metric-lbl">CEFR Mapped</span>
            </div>
            <div className="metric-div" />
            <div className="metric-item">
              <span className="metric-val">100%</span>
              <span className="metric-lbl">Automated Scoring</span>
            </div>
            <div className="metric-div" />
            <div className="metric-item">
              <span className="metric-val">Verified</span>
              <span className="metric-lbl">Certification</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Modules Grid */}
      <main className="modules-wrap">
        <div className="rich-container">
          <div className="section-title-row">
            <div>
              <span className="section-eyebrow">STANDARDIZED MODULES</span>
              <h2 className="section-heading">Select an Assessment</h2>
            </div>
            <p className="section-count">
              {modules.length} Modules Available
            </p>
          </div>

          {error && <div className="rich-error-banner">{error}</div>}

          {loading ? (
            <div className="rich-grid">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rich-skeleton" />
              ))}
            </div>
          ) : (
            <div className="rich-grid">
              {modules.map(mod => {
                const meta = getModuleMeta(mod.name);
                const attemptState = getAttemptState(mod.id);
                const isCompleted = attemptState.status === 'completed';
                const isOngoing = attemptState.status === 'in_progress';

                return (
                  <div key={mod.id} className={`module-tile ${isCompleted ? 'is-complete' : ''}`}>
                    <div className="tile-header">
                      <div className="icon-badge" style={{ color: meta.accent, background: meta.bg }}>
                        {getModuleIcon(mod.name)}
                      </div>
                      <span className="category-pill" style={{ borderColor: `${meta.accent}33`, color: meta.accent }}>
                        {meta.tag}
                      </span>
                    </div>

                    <div className="tile-content">
                      <h3 className="module-title">{mod.name}</h3>
                      <p className="module-synopsis">{meta.desc}</p>
                    </div>

                    <div className="tile-footer">
                      <div className="time-indicator">
                        <Clock size={14} />
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
                            <CheckCircle size={14} /> Completed
                          </>
                        ) : isOngoing ? (
                          <>
                            Resume <ArrowRight size={14} />
                          </>
                        ) : (
                          <>
                            Begin <ArrowRight size={14} />
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

      {/* Minimalist Executive Footer */}
      <footer className="rich-footer">
        <div className="rich-container footer-row">
          <div className="footer-left">
            <span className="footer-brand">Skill Bridge</span>
            <span className="footer-sep">&bull;</span>
            <span>A Product of Yaale Technologies</span>
          </div>
          <div className="footer-right">
            <span>&copy; {new Date().getFullYear()} All Rights Reserved</span>
          </div>
        </div>
      </footer>

      <style>{`
        /* ─── Rich Mood Styling (Luxury Dark Minimalist) ─── */
        :root {
          --rich-bg: #090e17;
          --rich-surface: #0f172a;
          --rich-card: rgba(18, 26, 43, 0.75);
          --rich-card-hover: rgba(22, 33, 56, 0.95);
          --rich-border: rgba(255, 255, 255, 0.07);
          --rich-border-hover: rgba(0, 168, 150, 0.45);
          --rich-emerald: #00A896;
          --rich-emerald-glow: rgba(0, 168, 150, 0.25);
          --rich-text: #f8fafc;
          --rich-muted: #94a3b8;
          --rich-dim: #64748b;
        }

        .rich-app {
          background-color: var(--rich-bg);
          color: var(--rich-text);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Inter', 'Segoe UI', Roboto, sans-serif;
          letter-spacing: -0.01em;
        }

        .rich-container {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Ambient Glows */
        .ambient-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(140px);
          pointer-events: none;
          z-index: 0;
        }
        .glow-top {
          top: -120px;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 380px;
          background: radial-gradient(circle, rgba(0, 168, 150, 0.18), transparent 70%);
        }
        .glow-bottom {
          bottom: 100px;
          right: -100px;
          width: 600px;
          height: 500px;
          background: radial-gradient(circle, rgba(2, 128, 144, 0.12), transparent 70%);
        }

        /* Subtle Geometric Grid */
        .subtle-grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 60% 50% at 50% 30%, #000 70%, transparent 100%);
          pointer-events: none;
          z-index: 0;
        }

        /* ─── Header ─── */
        .rich-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(9, 14, 23, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--rich-border);
          height: 76px;
        }
        .nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
        }
        .brand-group {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }
        .logo-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
        }
        .brand-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .brand-meta {
          display: flex;
          flex-direction: column;
        }
        .brand-name {
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .brand-sub {
          font-size: 10px;
          font-weight: 700;
          color: var(--rich-emerald);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 2px;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .nav-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--rich-muted);
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .nav-link-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .rich-login-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: var(--rich-emerald);
          color: #051a17;
          border: none;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 0 20px var(--rich-emerald-glow);
        }
        .rich-login-btn:hover {
          background: #00c2ad;
          transform: translateY(-1px);
          box-shadow: 0 4px 24px rgba(0, 168, 150, 0.45);
        }

        .user-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 10px 4px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--rich-border);
        }
        .avatar-chip {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--rich-emerald);
          color: #061a17;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-name-box {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .user-name {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }
        .user-id {
          font-size: 11px;
          color: var(--rich-dim);
        }
        .logout-mini-btn {
          background: transparent;
          border: none;
          color: var(--rich-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 4px;
        }
        .logout-mini-btn:hover {
          color: #f87171;
        }

        /* ─── Hero Section ─── */
        .rich-hero {
          position: relative;
          z-index: 1;
          padding: 80px 0 60px;
          text-align: center;
        }
        .hero-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(0, 168, 150, 0.08);
          border: 1px solid rgba(0, 168, 150, 0.25);
          font-size: 12px;
          font-weight: 700;
          color: var(--rich-emerald);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .sparkle-icon {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .hero-headline {
          font-size: 56px;
          font-weight: 900;
          line-height: 1.08;
          letter-spacing: -0.035em;
          margin: 0 0 20px 0;
          color: #ffffff;
        }
        .emerald-shimmer {
          background: linear-gradient(135deg, #00A896 0%, #06D6A0 50%, #99F6E4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-subtext {
          font-size: 18px;
          color: var(--rich-muted);
          max-width: 640px;
          line-height: 1.55;
          margin: 0 0 44px 0;
          font-weight: 400;
        }

        /* Metrics Strip */
        .metrics-strip {
          display: flex;
          align-items: center;
          background: rgba(18, 26, 43, 0.6);
          border: 1px solid var(--rich-border);
          border-radius: 999px;
          padding: 12px 28px;
          backdrop-filter: blur(12px);
          gap: 24px;
        }
        .metric-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .metric-val {
          font-size: 17px;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.1;
        }
        .metric-lbl {
          font-size: 11px;
          font-weight: 600;
          color: var(--rich-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 3px;
        }
        .metric-div {
          width: 1px;
          height: 28px;
          background: var(--rich-border);
        }

        /* ─── Modules Section ─── */
        .modules-wrap {
          position: relative;
          z-index: 1;
          padding: 40px 0 100px;
        }
        .section-title-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 32px;
          border-bottom: 1px solid var(--rich-border);
          padding-bottom: 18px;
        }
        .section-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: var(--rich-emerald);
          text-transform: uppercase;
        }
        .section-heading {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 4px 0 0 0;
        }
        .section-count {
          font-size: 13px;
          color: var(--rich-dim);
          font-weight: 600;
          margin: 0;
        }

        /* Grid */
        .rich-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }

        /* Module Tile (Rich Mood) */
        .module-tile {
          background: var(--rich-card);
          border: 1px solid var(--rich-border);
          border-radius: 20px;
          padding: 26px;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(16px);
          transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .module-tile:hover {
          background: var(--rich-card-hover);
          border-color: var(--rich-border-hover);
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 30px -10px var(--rich-emerald-glow);
        }
        .module-tile.is-complete {
          border-color: rgba(16, 185, 129, 0.25);
          background: rgba(16, 185, 129, 0.04);
        }

        .tile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .icon-badge {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        .module-tile:hover .icon-badge {
          transform: scale(1.05);
        }

        .category-pill {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.02);
        }

        .tile-content {
          flex: 1;
          margin-bottom: 24px;
        }
        .module-title {
          font-size: 21px;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 8px 0;
          letter-spacing: -0.015em;
        }
        .module-synopsis {
          font-size: 14px;
          color: var(--rich-muted);
          line-height: 1.5;
          margin: 0;
          min-height: 42px;
        }

        .tile-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .time-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--rich-dim);
        }

        /* Action Buttons */
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }
        .btn-start {
          background: var(--rich-emerald);
          color: #061f1b;
        }
        .btn-start:hover {
          background: #00c2ad;
          transform: translateX(2px);
          box-shadow: 0 0 16px var(--rich-emerald-glow);
        }
        .btn-resume {
          background: #f59e0b;
          color: #1a1202;
        }
        .btn-resume:hover {
          background: #fbbf24;
          transform: translateX(2px);
        }
        .btn-completed {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
          cursor: default;
        }

        /* Skeletons */
        .rich-skeleton {
          height: 220px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--rich-border);
          border-radius: 20px;
          animation: pulse 1.5s infinite;
        }

        .rich-error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          padding: 12px 18px;
          border-radius: 12px;
          font-size: 13px;
          margin-bottom: 24px;
        }

        /* ─── Footer ─── */
        .rich-footer {
          border-top: 1px solid var(--rich-border);
          padding: 32px 0;
          font-size: 13px;
          color: var(--rich-dim);
          position: relative;
          z-index: 1;
        }
        .footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .footer-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footer-brand {
          font-weight: 700;
          color: #e2e8f0;
        }
        .footer-sep {
          color: var(--rich-border);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hero-headline { font-size: 38px; }
          .hero-subtext { font-size: 16px; }
          .metrics-strip { flex-wrap: wrap; border-radius: 20px; gap: 16px; justify-content: center; }
          .metric-div { display: none; }
          .rich-grid { grid-template-columns: 1fr; }
          .footer-row { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default PublicHome;
