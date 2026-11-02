import React, { useState, useEffect } from 'react';
import api from '../api/api';
import {
    Trophy, Medal, Target, TrendingUp,
    CheckCircle2, XCircle, Search,
    Loader2, User, Mail, BarChart3,
    Calendar, Users, Award, Filter, Printer
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ResultEvaluation2 = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [moduleFilter, setModuleFilter] = useState('Overall');
    const [batchFilter, setBatchFilter] = useState('All Batches');
    const [statusFilter, setStatusFilter] = useState('All');
    const { showToast } = useToast();

    // Pagination states
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Leaderboard Stats states
    const [topScore, setTopScore] = useState(0);
    const [avgAccuracy, setAvgAccuracy] = useState(0);
    
    // Dynamic filters options
    const [allModuleNames, setAllModuleNames] = useState(['Grammar & Vocabulary', 'Listening', 'Numeracy', 'Reading', 'Speaking', 'Writing']);
    const [allBatches, setAllBatches] = useState([]);

    // Search input debouncer (300ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [moduleFilter, batchFilter, statusFilter]);

    useEffect(() => {
        fetchLeaderboardData();
    }, [page, pageSize, debouncedSearch, moduleFilter, batchFilter, statusFilter]);
    

    useEffect(() => {
        const adminMain = document.querySelector('.admin-main');
        if (selectedUser) {
            if (adminMain) {
                adminMain.style.overflow = 'hidden';
                adminMain.scrollTop = 0;
            }
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        } else {
            if (adminMain) {
                adminMain.style.overflow = 'auto';
            }
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
        }
        return () => {
            if (adminMain) adminMain.style.overflow = 'auto';
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
        };
    }, [selectedUser]);

    const fetchLeaderboardData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/leaderboard-data', {
                params: {
                    page,
                    page_size: pageSize,
                    search: debouncedSearch,
                    batch: batchFilter,
                    module_filter: moduleFilter,
                    status_filter: statusFilter
                }
            });
            if (res.data && typeof res.data === 'object' && 'items' in res.data) {
                const enhanced = res.data.items.map(user => {
                    const stats = calculateUserStats(user.modules);
                    return { ...user, ...stats, modules: stats.enrichedModules };
                });
                setData(enhanced);
                const metrics = calculateLeaderboardMetrics(enhanced);
                setTopScore(metrics.topScore);
                setAvgAccuracy(metrics.avgAccuracy);
                setTotalCount(res.data.total || 0);
                setTotalPages(res.data.pages || 1);
                if (res.data.all_batches) setAllBatches(res.data.all_batches);
                if (res.data.all_modules) setAllModuleNames(res.data.all_modules);
            } else {
                const enhanced = res.data.map(user => {
                    const stats = calculateUserStats(user.modules);
                    return { ...user, ...stats, modules: stats.enrichedModules };
                });
                enhanced.sort((a, b) => (b.accuracyPerc || 0) - (a.accuracyPerc || 0));
                setData(enhanced);
                const metrics = calculateLeaderboardMetrics(enhanced);
                setTopScore(metrics.topScore);
                setAvgAccuracy(metrics.avgAccuracy);
                setTotalCount(res.data.length || 0);
                setTotalPages(1);
            }
        } catch (err) {
            showToast('Failed to load leaderboard data', 'error');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = (user) => {
        const printWindow = window.open('', '_blank');
        const dateStr = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const modulesHtml = user.modules.map(mod => {
            // Calculate matched level from proficiency_mapping
            let matchedLevel = '—';
            if (mod.proficiency_mapping && Array.isArray(mod.proficiency_mapping)) {
                const score = parseFloat(mod.marks_obtained || 0);
                for (const rule of mod.proficiency_mapping) {
                    const min = parseFloat(rule.min);
                    const max = parseFloat(rule.max);
                    if (!isNaN(min) && !isNaN(max) && score >= min && score <= max) {
                        matchedLevel = rule.level;
                        break;
                    }
                }
            }
            return `
                <div class="module-row">
                    <div class="mod-name">${mod.module_name}</div>
                    <div class="mod-data">
                        <div class="data-item">
                            <span class="label">SKILL SCORE</span>
                            <span class="val">${parseFloat(mod.marks_obtained || 0)}/${parseFloat(mod.total_marks || 0)}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">LEVEL</span>
                            <span class="val level-val">${matchedLevel}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Result Report - ${user.name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                        body { font-family: 'Inter', sans-serif; margin: 0; padding: 50px; color: #1e293b; line-height: 1.5; }
                        .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 25px; margin-bottom: 40px; }
                        .brand { color: #007373; font-weight: 800; font-size: 24px; letter-spacing: -0.5px; }
                        .report-date { color: #64748b; font-weight: 600; font-size: 14px; }
                        
                        .candidate-section { margin-bottom: 40px; }
                        .candidate-name { font-size: 32px; font-weight: 800; margin: 0; color: #0f172a; }
                        .candidate-email { font-size: 16px; color: #64748b; margin: 4px 0 0 0; }
                        
                        .section-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 20px; border-left: 4px solid #007373; padding-left: 12px; }
                        .module-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
                        .mod-name { font-weight: 700; color: #334155; font-size: 15px; width: 200px; }
                        .mod-data { display: flex; gap: 40px; flex: 1; justify-content: flex-end; }
                        .data-item { display: flex; flex-direction: column; align-items: flex-end; }
                        .data-item .label { font-size: 9px; font-weight: 800; color: #94a3b8; margin-bottom: 2px; }
                        .data-item .val { font-size: 14px; font-weight: 700; color: #1e293b; }
                        .data-item .val.level-val { color: #2C347F; font-size: 18px; }
                        
                        @media print {
                            body { padding: 30px; }
                            .brand { color: #007373 !important; -webkit-print-color-adjust: exact; }
                            .data-item .val.level-val { color: #2C347F !important; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <div class="brand">Skill Bridge Assessment &bull; Yaale Technologies</div>
                        <div class="report-date">Report Generated: ${dateStr}</div>
                    </div>
                    
                    <div class="candidate-section">
                        <h1 class="candidate-name">${user.name}</h1>
                        <p class="candidate-email">${user.email}</p>
                    </div>
                    
                    <div class="section-title">Module-wise Performance Details</div>
                    <div class="modules-container">
                        ${modulesHtml}
                    </div>
                    
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.onafterprint = () => window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };


    const calculateUserStats = (modules) => {
        let totalMarksObtained = 0;
        let totalMarksPossible = 0;

        const enrichedModules = modules.map(mod => {
            totalMarksObtained += mod.marks_obtained || 0;
            totalMarksPossible += mod.total_marks || 0;
            const modAcc = mod.total_marks > 0 ? Math.round((mod.marks_obtained / mod.total_marks) * 100) : 0;
            return { ...mod, accuracyPerc: modAcc };
        });

        const accuracyPerc = totalMarksPossible > 0 ? Math.round((totalMarksObtained / totalMarksPossible) * 100) : 0;
        return {
            accuracyPerc,
            totalMarksObtained: parseFloat(totalMarksObtained.toFixed(1)),
            totalMarksPossible,
            enrichedModules,
        };
    };

    const calculateLeaderboardMetrics = (users) => {
        if (!Array.isArray(users) || users.length === 0) {
            return { topScore: 0, avgAccuracy: 0 };
        }

        const accuracies = users.map(user => {
            if (moduleFilter !== 'Overall') {
                const mod = user.modules.find(m => m.module_name === moduleFilter);
                return mod ? (mod.accuracyPerc || 0) : 0;
            }
            return user.accuracyPerc || 0;
        });

        const topScore = accuracies.length ? Math.max(...accuracies) : 0;
        const avgAccuracy = accuracies.length ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length) : 0;
        return { topScore, avgAccuracy };
    };

    const displayData = data;

    return (
        <div className="admin-container fade-in">
            {loading ? (
                <div className="loading-state-centered">
                    <Loader2 className="animate-spin" size={40} color="#007373" />
                    <p>Processing leaderboard standings...</p>
                </div>
            ) : (
                <>
                    {/* Header Section */}
                    <div className="leaderboard-page-header">
                        <div className="title-group">
                            <h2>Performance Insights</h2>
                            <p>Leaderboard Performance Analytics</p>
                        </div>
                        <div className="header-actions">
                            <div className="search-box">
                                <Search size={18} />
                                <input
                                    placeholder="Search candidate results..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="stats-row" style={{ marginBottom: '32px' }}>
                        <div className="stat-card card">
                            <div className="stat-icon-box blue">
                                <Users size={20} />
                            </div>
                            <div className="stat-info">
                                <h3>Total Candidates</h3>
                                <p>{data.length}</p>
                            </div>
                        </div>
                        <div className="stat-card card">
                            <div className="stat-icon-box amber">
                                <Trophy size={20} />
                            </div>
                            <div className="stat-info">
                                <h3>Top Candidate Accuracy</h3>
                                <p>{topScore.toLocaleString()}%</p>
                            </div>
                        </div>
                        <div className="stat-card card">
                            <div className="stat-icon-box emerald">
                                <BarChart3 size={20} />
                            </div>
                            <div className="stat-info">
                                <h3>Average Accuracy</h3>
                                <p>{avgAccuracy}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Leaderboard Table Part */}
                    <div className="user-management card" style={{ padding: 0 }}>
                        <div className="table-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <TrendingUp size={20} className="text-primary" />
                                <h3 style={{ margin: 0, fontSize: '18px' }}>Leaderboard Standings</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div className="module-filter-group">
                                    <div className="module-filter-container">
                                        <div className="filter-icon-bg">
                                            <Filter size={16} />
                                        </div>
                                        <div className="filter-content">
                                            <span className="filter-tag">ANALYSIS MODULE</span>
                                            <span className="module-display-value">
                                                {moduleFilter === 'Overall' ? 'Overall Leaderboard' : moduleFilter}
                                            </span>
                                        </div>
                                        <select
                                            className="module-filter-select-overlay"
                                            value={moduleFilter}
                                            onChange={(e) => setModuleFilter(e.target.value)}
                                        >
                                            <option value="Overall">Overall Leaderboard</option>
                                            {allModuleNames.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="module-filter-group">
                                    <div className="module-filter-container">
                                        <div className="filter-icon-bg" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                                            <TrendingUp size={16} />
                                        </div>
                                        <div className="filter-content">
                                            <span className="filter-tag">CANDIDATE BATCH</span>
                                            <span className="module-display-value">
                                                {batchFilter === 'All Batches' ? 'All Batches' : `Batch ${batchFilter}`}
                                            </span>
                                        </div>
                                        <select
                                            className="module-filter-select-overlay"
                                            value={batchFilter}
                                            onChange={(e) => setBatchFilter(e.target.value)}
                                        >
                                            <option value="All Batches">All Batches</option>
                                            {allBatches.map(b => (
                                                <option key={b} value={b}>Batch {b}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="module-filter-group">
                                    <div className="module-filter-container">
                                        <div className="filter-icon-bg" style={{ background: '#ecfdf5', color: '#059669' }}>
                                            <Award size={16} />
                                        </div>
                                        <div className="filter-content">
                                            <span className="filter-tag">RESULT STATUS</span>
                                            <span className="module-display-value">
                                                {statusFilter === 'All' ? 'All Candidates' : statusFilter === 'Pass' ? 'Pass (≥60%)' : 'Fail (<60%)'}
                                            </span>
                                        </div>
                                        <select
                                            className="module-filter-select-overlay"
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                        >
                                            <option value="All">All Candidates</option>
                                            <option value="Pass">Pass (≥ 60%)</option>
                                            <option value="Fail">{"Fail (< 60%)"}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="table-scroll">
                            {(!loading && displayData.length === 0) ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                                    No candidates found for the selected filters (try a different set or batch).
                                </div>
                            ) : (
                                <table className="eval2-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                                        <th>Candidate Info</th>
                                        <th>Overall Accuracy</th>
                                        <th style={{ width: '40%' }}>Question Tracking</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayData.map((user, idx) => {
                                        return (
                                            <tr key={user.user_id}>
                                                <td className="rank-td">
                                                    <div className={`rank-pill ${idx < 3 ? `rank-${idx + 1}` : ''}`}>
                                                        {idx < 3 ? <Award size={14} /> : (idx + 1)}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="cand-info">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
                                                            <div className="name-bold" title={user.name}>{user.name}</div>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handlePrint(user); }} 
                                                                className="mini-print-btn" 
                                                                title="Print Performance Report"
                                                            >
                                                                <Printer size={14} />
                                                            </button>
                                                        </div>
                                                        <div className="email-small" title={user.email}>{user.email}</div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="acc-breakdown">
                                                        <div className="overall-acc-pill">
                                                            <span className="label">OVERALL:</span>
                                                            <span className="value">{user.accuracyPerc}%</span>
                                                        </div>
                                                        <div className="module-pills-container">
                                                            {user.modules
                                                                .filter(mod => moduleFilter === 'Overall' || mod.module_name === moduleFilter)
                                                                .map((mod, midx) => {
                                                                    let code = mod.module_name === "Grammar & Vocabulary" ? "G" : mod.module_name.charAt(0).toUpperCase();
                                                                    const mPerc = mod.total_marks > 0 ? Math.round((mod.marks_obtained / mod.total_marks) * 100) : 0;
                                                                    
                                                                    let matchedLevel = '';
                                                                    if (mod.proficiency_mapping && Array.isArray(mod.proficiency_mapping)) {
                                                                        const score = parseFloat(mod.marks_obtained || 0);
                                                                        for (const rule of mod.proficiency_mapping) {
                                                                            const min = parseFloat(rule.min);
                                                                            const max = parseFloat(rule.max);
                                                                            if (!isNaN(min) && !isNaN(max) && score >= min && score <= max) {
                                                                                matchedLevel = rule.level;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }

                                                                    return (
                                                                        <div key={midx} className="mod-mark-pill" title={mod.module_name}>
                                                                            <span className="mod-code">{code}</span>
                                                                            <span className="mod-val">({parseFloat(mod.marks_obtained || 0)} / {parseFloat(mod.total_marks || 0)}) {mPerc}%</span>
                                                                            {matchedLevel && (
                                                                                <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: '4px', color: '#2C347F', fontWeight: '800' }}>
                                                                                    {matchedLevel}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="module-grid-mini clickable-tracking" onClick={() => setSelectedUser(user)}>
                                                        {(() => {
                                                            const activeModules = moduleFilter === 'Overall' ? user.modules : user.modules.filter(m => m.module_name === moduleFilter);
                                                            const maxQuestions = activeModules.length > 0 ? Math.min(10, Math.max(...activeModules.map(m => m.answers.length), 0)) : 0;
                                                            return (
                                                                <div className="q-header-row">
                                                                    <div className="mod-label-spacer"></div>
                                                                    <div className="q-labels">
                                                                        {Array.from({ length: maxQuestions }).map((_, i) => (
                                                                            <span key={i} className="q-header-label">Q{i + 1}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {user.modules
                                                            .filter(mod => moduleFilter === 'Overall' || mod.module_name === moduleFilter)
                                                            .map((mod, midx) => {
                                                                const displayAnswers = mod.answers.slice(0, 10);
                                                                const hasMore = mod.answers.length > 10;

                                                                return (
                                                                    <div key={midx} className="mod-track-item">
                                                                        <span className="mod-tiny-label">{mod.module_name === "Grammar & Vocabulary" ? "G & V" : mod.module_name}:</span>
                                                                        <div className="track-dots">
                                                                            {displayAnswers.map((ans, aidx) => (
                                                                                <div
                                                                                    key={aidx}
                                                                                    className={`mini-dot ${ans.evaluation_status === 'correct' ? 'correct' : 'wrong'}`}
                                                                                    title={`Q${aidx + 1}: ${ans.evaluation_status}`}
                                                                                >
                                                                                    {ans.evaluation_status === 'correct' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                                                                </div>
                                                                            ))}
                                                                            {hasMore && <div className="mini-dot more-indicator" title={`+${mod.answers.length - 10} more questions`}>...</div>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                </table>
                            )}
                        </div>
                        {/* Premium Pagination Footer */}
                        <div className="pagination-footer">
                           <div className="pagination-info">
                              Showing <span className="bold">{displayData.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                              <span className="bold">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                              <span className="bold">{totalCount}</span> candidates
                           </div>
                           
                           <div className="pagination-controls">
                              <button 
                                 onClick={() => setPage(p => Math.max(p - 1, 1))} 
                                 disabled={page === 1}
                                 className="page-btn prev-next"
                              >
                                 Previous
                              </button>
                              {(() => {
                                 const pages = [];
                                 const maxVisible = 5;
                                 if (totalPages <= maxVisible) {
                                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                                 } else {
                                    pages.push(1);
                                    const start = Math.max(2, page - 1);
                                    const end = Math.min(totalPages - 1, page + 1);
                                    if (start > 2) pages.push('...');
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    if (end < totalPages - 1) pages.push('...');
                                    pages.push(totalPages);
                                 }
                                 return pages.map((p, idx) => (
                                    <button
                                       key={idx}
                                       onClick={() => typeof p === 'number' && setPage(p)}
                                       disabled={p === '...'}
                                       className={`page-btn ${p === page ? 'active' : ''} ${p === '...' ? 'dots' : ''}`}
                                    >
                                       {p}
                                    </button>
                                 ));
                              })()}
                              <button 
                                 onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
                                 disabled={page === totalPages}
                                 className="page-btn prev-next"
                              >
                                 Next
                              </button>
                           </div>
                           
                           <div className="page-size-selector">
                              <span>Show</span>
                              <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}>
                                 <option value="10">10</option>
                                 <option value="20">20</option>
                                 <option value="30">30</option>
                              </select>
                              <span>per page</span>
                           </div>
                        </div>
                    </div>
                </>)}

            {/* ── Detailed Tracking Modal ── */}
            {selectedUser && (
                <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
                    <div className="modal-card wide fade-in-up tracking-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="header-icon-box bg-blue">
                                <Target size={24} />
                            </div>
                            <div className="header-text">
                                <h3>Candidate Detailed Tracking</h3>
                                <p>Full breakdown of all questions across modules.</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
                        </div>
                        <div className="modal-body scrollable-modal-body">
                            <div className="full-tracking-grid">
                                {(() => {
                                    const maxQuestions = Math.max(...selectedUser.modules.map(m => m.answers.length), 0);
                                    return (
                                        <div className="q-header-row expanded">
                                            <div className="mod-label-spacer large"></div>
                                            <div className="q-labels">
                                                {Array.from({ length: maxQuestions }).map((_, i) => (
                                                    <span key={i} className="q-header-label large">Q{i + 1}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {selectedUser.modules.map((mod, midx) => (
                                    <div key={midx} className="mod-track-item expanded">
                                        <span className="mod-large-label">{mod.module_name === "Grammar & Vocabulary" ? "G & V" : mod.module_name}:</span>
                                        <div className="track-dots large">
                                            {mod.answers.map((ans, aidx) => (
                                                <div
                                                    key={aidx}
                                                    className={`mini-dot large-dot ${ans.evaluation_status === 'correct' ? 'correct' : 'wrong'}`}
                                                    title={`Q${aidx + 1}: ${ans.evaluation_status}`}
                                                >
                                                    {ans.evaluation_status === 'correct' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .leaderboard-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
                .eval-loader-container { height: 60vh; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #64748b; font-weight: 600; text-align: center; }
                
                .title-group h2 { margin: 0 0 4px 0; font-size: 28px; }
                .title-group p { margin: 0; color: var(--secondary); font-size: 15px; }

                .stat-icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 16px; }
                .stat-icon-box.blue { background: #eaf5f5; color: #007373; }
                .stat-icon-box.amber { background: #fffbeb; color: #d97706; }
                .stat-icon-box.emerald { background: #f0fdf4; color: #16a34a; }
                .stat-card { display: flex; align-items: center; overflow: hidden; }
                .stat-info { flex: 1; min-width: 0; }
                .stat-info h3 { font-size: 12px; color: var(--secondary); margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .stat-info p { font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .user-management { overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
                .table-scroll { overflow-x: auto; width: 100%; }
                .eval2-table { width: 100%; border-collapse: collapse; min-width: 900px; }
                .eval2-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 700; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid var(--border); }
                .eval2-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid var(--border); transition: background 0.2s; }
                .eval2-table tr:hover td { background: #fdfdfd; }

                .rank-td { text-align: center; }
                .rank-pill { width: 32px; height: 32px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 50%; font-weight: 800; font-size: 13px; color: var(--secondary); }
                .rank-1 { background: #fef9c3; color: #a16207; box-shadow: 0 0 0 2px #fde047; }
                .rank-2 { background: #f1f5f9; color: #475569; box-shadow: 0 0 0 2px #cbd5e1; }
                .rank-3 { background: #ffedd5; color: #9a3412; box-shadow: 0 0 0 2px #fed7aa; }

                .cand-info { max-width: 220px; }
                .cand-info .name-bold { font-weight: 700; color: var(--text-main); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
                .cand-info .email-small { font-size: 12px; color: var(--secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

                
                .acc-breakdown { display: flex; flex-direction: column; gap: 8px; }
                .overall-acc-pill { display: flex; align-items: center; gap: 6px; }
                .overall-acc-pill .label { font-size: 10px; font-weight: 800; color: var(--secondary); letter-spacing: 0.05em; }
                .overall-acc-pill .value { font-size: 16px; font-weight: 800; color: #16a34a; }
                
                .module-pills-container { display: flex; flex-wrap: wrap; gap: 4px; }
                .mod-mark-pill { display: flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid var(--border); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
                .mod-code { color: var(--primary); font-weight: 800; border-right: 1px solid var(--border); padding-right: 4px; }
                .mod-val { color: var(--text-soft); }

                .module-grid-mini { display: flex; flex-direction: column; gap: 4px; background: #fbfcfe; padding: 12px; border-radius: 8px; border: 1px dashed var(--border); }
                .clickable-tracking { cursor: pointer; transition: all 0.2s; position: relative; }
                .clickable-tracking:hover { border-color: #007373; background: #f0f8f8; }
                .clickable-tracking:hover::after { content: 'Click for details'; position: absolute; top: -20px; right: 0; font-size: 9px; font-weight: 800; color: #007373; text-transform: uppercase; }

                .q-header-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
                .mod-label-spacer { min-width: 75px; flex-shrink: 0; }
                .q-labels { display: flex; gap: 4px; }
                .q-header-label { width: 15px; font-size: 8px; font-weight: 800; color: var(--secondary); text-align: center; }

                .mod-track-item { display: flex; align-items: center; gap: 6px; }
                .mod-tiny-label { min-width: 75px; font-size: 10px; font-weight: 700; color: var(--text-soft); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }
                .track-dots { display: flex; gap: 4px; align-items: center; }
                .mini-dot { width: 15px; height: 15px; border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .mini-dot.correct { background: #f0fdf4; color: #16a34a; }
                .mini-dot.wrong { background: #fef2f2; color: #ef4444; }
                .more-indicator { font-size: 10px; font-weight: 800; color: #94a3b8; background: #f1f5f9; cursor: help; }

                /* Modal Specifics - Full Tracking Grid */
                .modal-card.tracking-modal { max-width: 98% !important; width: 98% !important; margin: 10px auto !important; display: flex; flex-direction: column; max-height: 85vh; border-radius: 16px !important; }
                .scrollable-modal-body { padding: 16px 24px; overflow-y: auto; flex: 1; }
                .full-tracking-grid { display: flex; flex-direction: column; gap: 8px; background: #fbfcfe; padding: 16px; border-radius: 12px; border: 1px solid var(--border); overflow-x: auto; }
                
                .modal-overlay { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; align-items: flex-start !important; padding: 10px !important; overflow-y: auto !important; z-index: 9999 !important; background: rgba(15, 23, 42, 0.8) !important; }
                
                /* Custom Scrollbar for the grid */
                .full-tracking-grid::-webkit-scrollbar { height: 6px; }
                .full-tracking-grid::-webkit-scrollbar-track { background: #f1f5f9; }
                .full-tracking-grid::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

                .q-header-row.expanded { border-bottom: 2px solid #e2e8f0; margin-bottom: 8px; padding-bottom: 8px; display: flex; width: max-content; gap: 12px; align-items: center; }
                .mod-label-spacer.large { min-width: 120px; flex-shrink: 0; }
                .q-header-label.large { width: 24px; font-size: 11px; font-weight: 800; color: #64748b; text-align: center; }

                .mod-track-item.expanded { border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; display: flex; width: max-content; gap: 12px; align-items: center; }
                .mod-large-label { min-width: 120px; font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em; flex-shrink: 0; }
                .q-labels { display: flex; gap: 6px; }
                .track-dots.large { display: flex; gap: 6px; align-items: center; }
                .large-dot { width: 24px; height: 24px; border-radius: 6px; font-size: 12px; }
                .large-dot.correct { background: #f0fdf4; color: #16a34a; }
                .large-dot.wrong { background: #fef2f2; color: #ef4444; }

                .mini-print-btn { border: 1px solid #e2e8f0; background: white; color: #94a3b8; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; padding: 4px; border-radius: 6px; }
                .mini-print-btn:hover { background: #f0f8f8; color: #007373; border-color: #007373; transform: scale(1.1); }

                .modal-overlay { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; z-index: 9999 !important; background: rgba(15, 23, 42, 0.8) !important; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
                .modal-card { background: white; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); position: relative; animation: modalSlideUp 0.3s ease-out; }
                @keyframes modalSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: white; }
                .header-icon-box { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-right: 16px; }
                .header-icon-box.bg-blue { background: #eaf5f5; color: #007373; }
                .header-text h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1e293b; }
                .header-text p { margin: 2px 0 0 0; font-size: 13px; color: #64748b; }
                .close-btn { width: 36px; height: 36px; border-radius: 10px; border: none; background: #f1f5f9; color: #64748b; font-size: 20px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .close-btn:hover { background: #fee2e2; color: #ef4444; }

                .search-box { position: relative; display: flex; align-items: center; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 0 12px; height: 46px; width: 300px; }
                .search-box input { border: none; padding: 10px; width: 100%; outline: none; font-size: 14px; }
                .text-primary { color: var(--primary); }

                .module-filter-group { display: flex; align-items: center; }
                .module-filter-container { 
                    display: flex; 
                    align-items: center; 
                    gap: 14px; 
                    background: white; 
                    padding: 8px 18px 8px 10px; 
                    border-radius: 14px; 
                    border: 1px solid var(--border); 
                    box-shadow: 0 2px 10px rgba(0,0,0,0.03);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .module-filter-container:hover { 
                    border-color: #007373; 
                    box-shadow: 0 4px 20px rgba(0, 115, 115, 0.12);
                    transform: translateY(-1px);
                }
                .filter-icon-bg {
                    width: 36px;
                    height: 36px;
                    background: #f0f8f8;
                    color: #007373;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                }
                .filter-content { display: flex; flex-direction: column; gap: 2px; }
                .filter-tag { 
                    font-size: 9px; 
                    font-weight: 800; 
                    color: #94a3b8; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em; 
                }
                .module-display-value {
                    font-weight: 800; 
                    color: #1e293b; 
                    font-size: 14px; 
                    min-width: 160px;
                }
                .module-filter-select-overlay { 
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 10;
                }

                /* Premium Pagination Footer Styles */
                .pagination-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid #f1f5f9; background: #ffffff; flex-wrap: wrap; gap: 16px; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; }
                .pagination-info { font-size: 14px; color: #64748b; }
                .pagination-controls { display: flex; align-items: center; gap: 8px; }
                .page-btn { height: 38px; min-width: 38px; padding: 0 12px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #e2e8f0; background: white; color: #475569; transition: all 0.2s ease; }
                .page-btn:hover:not(:disabled):not(.dots) { border-color: #cbd5e1; background: #f8fafc; color: #1e293b; transform: translateY(-1px); }
                .page-btn.active { background: #007373; color: white; border-color: #007373; box-shadow: 0 4px 6px -1px rgba(0, 115, 115, 0.2); font-weight: 600; }
                .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .page-btn.dots { border-color: transparent; background: transparent; cursor: default; }
                .page-btn.prev-next { font-weight: 600; }
                .page-size-selector { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #64748b; }
                .page-size-selector select { padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; color: #1e293b; cursor: pointer; outline: none; transition: all 0.2s; }
            `}</style>
        </div>
    );
};

export default ResultEvaluation2;
