import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from '../api/api';
import {
   Users, Search, Calendar, Book,
   CheckCircle, Clock, ChevronRight, Edit2,
   Lock, ArrowLeft, Loader2, Play, Download,
   Filter, ChevronDown
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ResultEvaluation = () => {
   const { showToast } = useToast();
   const [view, setView] = useState('list'); // list, detail, eval
   const [attempts, setAttempts] = useState([]);
   const [selectedCandidate, setSelectedCandidate] = useState(null);
   const [selectedAttempt, setSelectedAttempt] = useState(null);
   const [loading, setLoading] = useState(false);

   // Filters
   const [timeFilter, setTimeFilter] = useState('all');
   const [moduleFilter, setModuleFilter] = useState('');
   const [search, setSearch] = useState('');
   const [debouncedSearch, setDebouncedSearch] = useState('');

   // Pagination states
   const [page, setPage] = useState(1);
   const [pageSize, setPageSize] = useState(10);
   const [totalPages, setTotalPages] = useState(1);
   const [totalCount, setTotalCount] = useState(0);

   // Evaluation form state
   const [scores, setScores] = useState({});
   const [manualMarks, setManualMarks] = useState({}); // question_id -> true (correct) | false (incorrect) | null
   const [comments, setComments] = useState('');
   const [isSaving, setIsSaving] = useState(false);
   const [showFilterDropdown, setShowFilterDropdown] = useState(false);

   // Search input debouncer (300ms)
   useEffect(() => {
      const handler = setTimeout(() => {
         setDebouncedSearch(search);
         setPage(1);
      }, 300);
      return () => clearTimeout(handler);
   }, [search]);

   useEffect(() => {
      if (view === 'list') {
         fetchAttempts();
      }
   }, [view, timeFilter, page, pageSize, debouncedSearch]);

   const fetchAttempts = async () => {
      setLoading(true);
      try {
         const res = await api.get('/admin/candidate-evaluations', {
            params: { 
               time_range: timeFilter,
               page,
               page_size: pageSize,
               search: debouncedSearch
            }
         });
         
         if (res.data && typeof res.data === 'object' && 'items' in res.data) {
            setAttempts(res.data.items);
            setTotalCount(res.data.total || 0);
            setTotalPages(res.data.pages || 1);
         } else {
            setAttempts(res.data || []);
            setTotalCount(res.data?.length || 0);
            setTotalPages(1);
         }
      } catch (err) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   };

   const handleCandidateClickFromAttempt = async (attempt) => {
      setLoading(true);
      try {
         const res = await api.get(`/admin/candidate-results/${attempt.user_id}`);
         setSelectedCandidate({
            id: attempt.user_id,
            fullname: attempt.candidate_name,
            email: attempt.candidate_email,
            results: res.data.results
         });
         setView('detail');
      } catch (err) {
         showToast('Failed to load candidate results', 'error');
      } finally {
         setLoading(false);
      }
   };

   const handleModuleClick = async (attemptId) => {
      setLoading(true);
      try {
         const res = await api.get(`/admin/attempt/${attemptId}`);
         setSelectedAttempt(res.data);
         const initialScores = {};
         const initialManual = {};
         res.data.answers.forEach(a => {
            initialScores[a.question_id] = a.marks_obtained || 0;
            // Load persistent evaluation_status (correct/wrong)
            if (a.evaluation_status) {
               initialManual[a.question_id] = a.evaluation_status === 'correct';
            } else {
               // Default for auto-evaluated if no manual override yet
               const isAutoEval = ['MCQ', 'AUDIO_MCQ', 'DRAG_DROP_ORDERING', 'DRAG_DROP_SLOTS'].includes(a.question_type);
               if (isAutoEval) {
                  if (['MCQ', 'AUDIO_MCQ'].includes(a.question_type)) {
                     const isCorrect = a.selected_option_text === a.correct_option_text;
                     initialManual[a.question_id] = isCorrect;
                  } else {
                     // For D&D, check if marks_obtained matches max marks
                     initialManual[a.question_id] = (a.marks_obtained >= a.question_marks);
                  }
               } else {
                  initialManual[a.question_id] = null;
               }
            }
         });
         setScores(initialScores);
         setManualMarks(initialManual);
         setComments('');
         setView('eval');
      } catch (err) {
         showToast('Failed to load attempt details', 'error');
      } finally {
         setLoading(false);
      }
   };

   if (loading) return (
      <div className="loading-state-centered">
         <Loader2 className="animate-spin" size={40} color="#007373" />
         <p>Preparing evaluation details...</p>
      </div>
   );

   const submitEvaluation = async (lock = false) => {
      setIsSaving(true);
      try {
         // Convert boolean manualMarks to API statuses
         const apiManualMarks = {};
         Object.entries(manualMarks).forEach(([qid, val]) => {
            if (val !== null) apiManualMarks[qid] = val ? 'correct' : 'wrong';
         });

         await api.post(`/admin/evaluate/${selectedAttempt.id}`, {
            scores,
            manual_marks: apiManualMarks,
            comments,
            is_locked: lock
         });
         showToast(lock ? 'Evaluation finalized and locked' : 'Evaluation saved as draft', lock ? 'success' : 'info');
         // If we came from detail view, go back there
         if (selectedCandidate) {
            const res = await api.get(`/admin/candidate-results/${selectedCandidate.id}`);
            setSelectedCandidate({ ...selectedCandidate, results: res.data.results });
            setView('detail');
         } else {
            setView('list');
         }
      } catch (err) {
         const detail = err.response?.data?.detail;
         const errorMsg = Array.isArray(detail)
            ? detail.map(d => `${d.loc[1]}: ${d.msg}`).join('\n')
            : detail || 'Evaluation failed';
         showToast(errorMsg, 'error');
      } finally {
         setIsSaving(false);
      }
   };



   if (view === 'list') return (
      <div className="eval-module fade-in">
         <div className="module-header">
            <h2>Result Evaluation</h2>
            <div className="filters">
               <div className="search-box">
                  <Search size={18} />
                  <input placeholder="Search candidate..." value={search} onChange={e => setSearch(e.target.value)} />
               </div>
               <div className="premium-dropdown" onClick={() => setShowFilterDropdown(!showFilterDropdown)}>
                  <Filter size={16} className="p-icon" />
                  <span className="current-value">
                     {timeFilter === 'all' ? 'All Activity' : 
                      timeFilter === 'today' ? 'Today' : 
                      timeFilter === 'yesterday' ? 'Yesterday' : 'Last 7 Days'}
                  </span>
                  <ChevronDown size={16} className={`p-chevron ${showFilterDropdown ? 'open' : ''}`} />
                  
                  {showFilterDropdown && (
                     <div className="dropdown-menu-custom fade-in-down">
                        <div className={`menu-item ${timeFilter === 'all' ? 'active' : ''}`} onClick={() => { setTimeFilter('all'); setShowFilterDropdown(false); }}>All Activity</div>
                        <div className={`menu-item ${timeFilter === 'today' ? 'active' : ''}`} onClick={() => { setTimeFilter('today'); setShowFilterDropdown(false); }}>Today</div>
                        <div className={`menu-item ${timeFilter === 'yesterday' ? 'active' : ''}`} onClick={() => { setTimeFilter('yesterday'); setShowFilterDropdown(false); }}>Yesterday</div>
                        <div className={`menu-item ${timeFilter === 'week' ? 'active' : ''}`} onClick={() => { setTimeFilter('week'); setShowFilterDropdown(false); }}>Last 7 Days</div>
                     </div>
                  )}
               </div>
            </div>
         </div>

         <div className="candidate-table card">
            <table>
               <thead>
                  <tr>
                     <th>Candidate</th>
                     <th>Last Activity</th>
                     <th>Progress</th>
                     <th>Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {attempts.length === 0 ? (
                     <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                           No candidate evaluations found.
                        </td>
                     </tr>
                  ) : (
                     attempts.map(a => (
                        <tr key={a.user_id}>
                           <td>
                              <div className="user-info-row">
                                 <Users size={16} />
                                 <div>
                                    <p className="bold">{a.candidate_name}</p>
                                    <p className="sub-text">{a.candidate_email}</p>
                                 </div>
                              </div>
                           </td>
                           <td>
                              <div className="activity-cell">
                                 <Calendar size={14} />
                                 <span>{a.last_activity ? new Date(a.last_activity).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No activity'}</span>
                              </div>
                           </td>
                           <td>
                              <div className="progress-cell">
                                 <div className="progress-info">
                                    <Book size={14} />
                                    <span>{a.completed_modules} / {a.total_modules} Modules</span>
                                 </div>
                                 <div className="mini-progress-bar">
                                    <div className="bar-fill" style={{ width: `${(a.completed_modules / (a.total_modules || 1)) * 100}%` }}></div>
                                 </div>
                              </div>
                           </td>
                           <td>
                              <button onClick={() => handleCandidateClickFromAttempt({ user_id: a.user_id, candidate_name: a.candidate_name, candidate_email: a.candidate_email })} className="btn-secondary">
                                 View Evaluation <ChevronRight size={16} />
                              </button>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>

            {/* Premium Pagination Footer */}
            <div className="pagination-footer">
               <div className="pagination-info">
                  Showing <span className="bold">{attempts.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
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

         <style>{`
        .eval-module { padding: 40px; }
        .module-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .filters { display: flex; gap: 16px; align-items: center; }
        .search-box { display: flex; align-items: center; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 0 12px; height: 46px; transition: all 0.2s; }
        .search-box:focus-within { border-color: #007373; box-shadow: 0 0 0 4px rgba(0, 115, 115, 0.1); }
        .search-box input { border: none; padding: 10px; outline: none; background: transparent; }
        
        .premium-dropdown { position: relative; display: flex; align-items: center; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 0 16px; height: 46px; min-width: 200px; transition: all 0.2s; cursor: pointer; user-select: none; }
        .premium-dropdown:hover { border-color: #007373; background: #f8fafc; }
        .current-value { font-size: 14px; font-weight: 700; color: #1e293b; flex: 1; }
        .p-icon { color: #007373; margin-right: 12px; }
        .p-chevron { color: #64748b; transition: transform 0.2s; }
        .p-chevron.open { transform: rotate(180deg); }
        
        .dropdown-menu-custom { position: absolute; top: calc(100% + 8px); left: 0; width: 100%; background: white; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; z-index: 100; overflow: hidden; padding: 6px; }
        .menu-item { padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; color: #475569; transition: all 0.2s; }
        .menu-item:hover { background: #f1f5f9; color: #007373; }
        .menu-item.active { background: #eaf5f5; color: #007373; font-weight: 700; }
        
        .fade-in-down { animation: fadeInDown 0.2s ease-out; }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
        .candidate-table { padding: 0; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 16px 24px; background: #f8fafc; font-size: 13px; color: var(--secondary); border-bottom: 1px solid var(--border); }
        td { padding: 16px 24px; border-bottom: 1px solid var(--border); }
        .user-info-row { display: flex; align-items: center; gap: 12px; }
        .bold { font-weight: 700; color: var(--text-main); margin: 0; }
        .sub-text { font-size: 12px; color: var(--secondary); margin: 0; }
        .status-tag { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
        .status-tag.completed { background: #f0fdf4; color: #16a34a; }
        .status-tag.in_progress { background: #fffbeb; color: #d97706; }
        .status-tag.action_required { background: #fef2f2; color: #ef4444; border: 1px solid #fee2e2; }
        .status-tag.partial { background: #eaf5f5; color: #007373; }
        .activity-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; font-weight: 500; }
        .progress-cell { display: flex; flex-direction: column; gap: 6px; min-width: 150px; }
        .progress-info { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #475569; }
        .mini-progress-bar { width: 100%; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; background: #007373; border-radius: 10px; transition: width 0.3s ease; }
        .pub-tag { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #16a34a; background: #f0fdf4; padding: 4px 10px; border-radius: 20px; }
        .pending-tag { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; }
        .btn-secondary { display: flex; align-items: center; gap: 4px; padding: 8px 16px; font-size: 13px; }

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

   if (view === 'detail') return (
      <div className="detail-module fade-in">
         <style>{`
            .candidate-hero { display: flex; justify-content: space-between; align-items: center; }
            .hero-actions { display: flex; gap: 16px; align-items: center; }
            .btn-publish { display: flex; align-items: center; gap: 8px; background: #007373 !important; color: white !important; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0, 115, 115,0.2); }
            .btn-publish:hover { background: #005959 !important; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0, 115, 115,0.3); }
            .published-badge { display: flex; align-items: center; gap: 8px; background: #f0fdf4; color: #16a34a; padding: 10px 20px; border-radius: 12px; font-weight: 700; font-size: 14px; border: 1px solid #dcfce7; }
         `}</style>
         <button onClick={() => setView('list')} className="back-btn"><ArrowLeft size={18} /> Back to List</button>

         <div className="candidate-hero card">
            <div className="hero-info">
               <h1>{selectedCandidate.fullname}</h1>
               <p>{selectedCandidate.email} • Candidate ID: #{selectedCandidate.id}</p>
            </div>
            <div className="hero-actions">
               <span className="published-badge"><CheckCircle size={18} /> Evaluation Live</span>
            </div>
         </div>

         <div className="module-results-grid">
            {['Speaking', 'Listening', 'Writing', 'Reading', 'Grammar & Vocabulary', 'Numeracy'].map(modName => {
               const attempt = selectedCandidate.results?.find(r => r.module_name === modName);
               const isCompleted = attempt?.status === 'COMPLETED';
               const isAttempted = attempt?.status === 'IN_PROGRESS';
               return (
                  <div key={modName} className={`mod-result-card card ${attempt ? 'has-data' : 'no-data'} ${isCompleted ? 'completed' : ''} ${isAttempted ? 'attempted' : ''}`}>
                     <div className="res-header">
                        <h3>{modName}</h3>
                        {attempt && (
                           <span className={`status-tag ${attempt.status.toLowerCase()}`}>
                              {isAttempted ? 'ATTEMPTED' : attempt.status}
                           </span>
                        )}
                     </div>

                     {isCompleted ? (
                        <div className="res-body">
                           <div className="score-display">
                              <span className="score-val">{parseFloat(attempt.score || 0)}</span>
                              <span className="score-label">Points</span>
                           </div>



                           <button onClick={() => handleModuleClick(attempt.id)} className="btn-primary">
                              {attempt.is_locked ? 'View Evaluation' : 'Evaluate'}
                           </button>
                        </div>
                     ) : isAttempted ? (
                        <div className="res-body">
                           <div className="score-display attempted-score">
                              <span className="score-val">Attempted</span>
                              <span className="score-label">Not Submitted</span>
                           </div>
                           <div className="attempt-note">
                              This candidate has started the test, but it has not been submitted yet.
                           </div>
                        </div>
                     ) : (
                        <div className="res-empty">
                           <Clock size={40} opacity={0.2} />
                           <p>Not attempted yet</p>
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         <style>{`
         .detail-module { padding: 40px; }
         .back-btn { display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--secondary); margin-bottom: 24px; border: none; background: none; cursor: pointer; }
         .candidate-hero { padding: 40px; margin-bottom: 30px; background: white; color: var(--text-main); border: 1px solid var(--border); border-radius: 16px; }
         .hero-info h1 { margin-bottom: 8px; font-size: 32px; color: #1e293b; }
         .hero-info p { color: #64748b; font-size: 16px; margin: 0; }
         .module-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
         .mod-result-card { padding: 30px; border: 2px solid transparent; border-radius: 16px; }
         .mod-result-card.has-data { border-color: #eaf5f5; }
         .mod-result-card.completed { border-color: #dcfce7; background: linear-gradient(to bottom right, #ffffff, #f0fdf4); }
         .mod-result-card.attempted { border-color: #fde68a; background: linear-gradient(to bottom right, #ffffff, #fffbeb); }
         .res-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
         .score-display { margin-bottom: 20px; }
         .score-val { font-size: 32px; font-weight: 700; color: var(--primary); }
         .score-label { font-size: 14px; color: var(--secondary); margin-left: 8px; }
         .attempted-score .score-val { color: #d97706; font-size: 28px; }
         .attempted-score .score-label { color: #92400e; margin-left: 0; display: block; margin-top: 6px; }
         .attempt-note { padding: 14px 16px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 14px; font-weight: 600; line-height: 1.5; }
         .res-empty { text-align: center; color: var(--secondary); opacity: 0.6; padding: 20px 0; }
       `}</style>
      </div>
   );

   if (view === 'eval') {
      const liveTotal = Object.values(scores).reduce((acc, score) => acc + (parseFloat(score) || 0), 0);

      return (
         <div className="evaluation-module fade-in">
         <button
            onClick={() => setView(selectedCandidate ? 'detail' : 'list')}
            className="back-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, color: '#64748b', marginBottom: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
         >
            <ArrowLeft size={18} /> Back
         </button>

         <div className="eval-header-row">
            <div>
               <h2>{selectedAttempt.module} Evaluation</h2>
               <p>Candidate: {selectedAttempt.candidate}</p>
            </div>
            <div className="eval-actions">
               {!selectedAttempt.is_locked && (
                  <>
                     <button className="btn-secondary" onClick={() => submitEvaluation(false)} disabled={isSaving}>Save Draft</button>
                     <button className="btn-primary" onClick={() => submitEvaluation(true)} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : 'Final Submit & Lock'}
                     </button>
                  </>
               )}
               {selectedAttempt.is_locked && <span className="locked-badge"><Lock size={16} /> Result Locked</span>}
            </div>
         </div>

         <div className="score-eval-banner" style={{ background: 'linear-gradient(to right, #f8fafc, #eaf5f5)', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid #e2e8f0', display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ flex: '1' }}>
               <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', marginBottom: '8px' }}>Performance Status</h4>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>Evaluation Summary</span>
               </div>
               <p style={{ fontSize: '14px', color: '#475569', margin: 0 }}>Reviewing the candidate's responses for the {selectedAttempt.module} module.</p>
            </div>
            <div style={{ textAlign: 'right', borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
               <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>LIVE RAW SCORE</div>
               <div style={{ fontSize: '28px', fontWeight: '900', color: '#007373' }}>{liveTotal}</div>
            </div>
         </div>

         <div className="answers-list">
            {selectedAttempt.answers.map((ans, i) => (
               <div key={i} className="ans-review-card card">
                  <div className="ans-meta">
                     <span className="q-label">Question {i + 1} ({ans.question_type})</span>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Score:</span>
                         <span style={{ fontWeight: '800', fontSize: '15px', color: '#007373', background: '#eaf5f5', padding: '4px 12px', borderRadius: '8px' }}>
                            {(() => {
                               const currentObtained = scores[ans.question_id] !== undefined ? scores[ans.question_id] : (ans.marks_obtained || 0);
                               return `${currentObtained} / ${ans.question_marks}`;
                            })()}
                         </span>
                     </div>
                  </div>
                  <p className="q-txt">{ans.question_text}</p>

                  <div className="ans-body">
                     {/* Answer Content Display */}
                     {ans.question_type === 'WRITING_PROMPT' ? (
                        <div className="writing-preview">{ans.text_response || 'No submission received.'}</div>
                     ) : ans.question_type === 'SPEAKING_PROMPT' ? (
                        <div className="audio-preview">
                           {ans.audio_response ? (
                              <>
                                 <audio controls src={`${BASE_URL}/${ans.audio_response}`} />
                                 <a href={`${BASE_URL}/${ans.audio_response}`} className="dl-btn" download><Download size={14} /> Download Audio</a>
                              </>
                           ) : <p className="sub-text">No audio recorded</p>}
                        </div>
                     ) : (ans.question_type === 'DRAG_DROP_ORDERING' || ans.question_type === 'DRAG_DROP_SLOTS') ? (
                        <div className="dd-ordering-preview">
                           {ans.text_response ? (() => {
                              let userMapping = [];
                              try { userMapping = JSON.parse(ans.text_response); } catch (e) { return <p className="sub-text">Malformed result</p>; }
                              const data = ans.drag_drop_data || { items: [] };
                              const isOrdering = ans.question_type === 'DRAG_DROP_ORDERING';

                              return (
                                 <div className="ordering-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {userMapping.map((itemId, pos) => {
                                       if (itemId === null && !isOrdering) return (
                                          <div key={pos} style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '13px', color: '#64748b' }}>
                                             <span style={{ fontWeight: 700 }}>{pos + 1}.</span> [Empty Slot]
                                          </div>
                                       );
                                       const item = data.items?.[itemId] || `Item ${itemId}`;
                                       const itemText = typeof item === 'string' ? item : item.text;
                                       const itemOrder = typeof item === 'string' ? (itemId + 1) : item.order;
                                       const isCorrectPos = itemOrder === (pos + 1);
                                       return (
                                          <div key={pos} style={{
                                             background: isCorrectPos ? '#f0fdf4' : '#fef2f2',
                                             padding: '8px 12px',
                                             borderRadius: '8px',
                                             border: `1px solid ${isCorrectPos ? '#bbf7d0' : '#fecaca'}`,
                                             fontSize: '13px',
                                             display: 'flex',
                                             alignItems: 'center',
                                             gap: '10px'
                                          }}>
                                             <span style={{ fontWeight: 700, color: '#64748b', width: '20px' }}>{pos + 1}.</span>
                                             <span style={{ flex: 1 }}>{itemText}</span>
                                             {!isCorrectPos && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Incorrect Pos (Target: {itemOrder})</span>}
                                          </div>
                                       );
                                    })}
                                 </div>
                              );
                           })() : <p className="sub-text">No answer provided</p>}
                        </div>
                     ) : (
                        <div className="mcq-preview">
                           <div className="selected-ans">
                              Candidate Selected: <strong>{ans.selected_option_text || 'No Answer'}</strong>
                              {ans.selected_option_text === ans.correct_option_text ?
                                 <span className="correct-tag" style={{ marginLeft: '10px', color: '#16a34a', fontWeight: '800' }}>✓ CORRECT (Auto)</span> :
                                 <span className="incorrect-tag" style={{ marginLeft: '10px', color: '#ef4444', fontWeight: '800' }}>✗ INCORRECT (Auto)</span>
                              }
                           </div>
                           {ans.selected_option_text !== ans.correct_option_text && (
                              <div className="correct-ans" style={{ marginTop: '8px', fontSize: '13px', color: '#64748b' }}>
                                 Correct Answer: <strong style={{ color: '#16a34a' }}>{ans.correct_option_text}</strong>
                              </div>
                           )}
                        </div>
                     )}

                     {/* UNIFIED MANUAL MARKING CONTROL */}
                     {!selectedAttempt.is_locked && (
                        <div className="manual-mark-ctrl" style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '16px', alignItems: 'center' }}>
                           <span style={{ fontWeight: '700', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Correction:</span>
                           <div className="protocol-btns" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              {['WRITING_PROMPT', 'SPEAKING_PROMPT'].includes(ans.question_type) ? (
                                 <div className="score-ctrl" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Score:</span>
                                    <input 
                                       type="number" 
                                       min="0" 
                                       max={ans.question_marks}
                                       step="0.5"
                                       value={scores[ans.question_id] !== undefined ? scores[ans.question_id] : (ans.marks_obtained || 0)}
                                       onChange={(e) => {
                                          let val = parseFloat(e.target.value);
                                          if (isNaN(val)) val = 0;
                                          if (val > ans.question_marks) val = ans.question_marks;
                                          if (val < 0) val = 0;
                                          setScores({ ...scores, [ans.question_id]: val });
                                          setManualMarks({ ...manualMarks, [ans.question_id]: val === ans.question_marks ? true : (val === 0 ? false : null) });
                                       }}
                                    />
                                    <span style={{ fontSize: '14px', color: '#64748b' }}>/ {ans.question_marks}</span>
                                 </div>
                              ) : (
                                 <>
                              <button
                                 onClick={() => {
                                    setManualMarks({ ...manualMarks, [ans.question_id]: true });
                                    setScores({ ...scores, [ans.question_id]: ans.question_marks });
                                 }}
                                 style={{
                                    padding: '8px 20px', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                    background: manualMarks[ans.question_id] === true ? '#16a34a' : '#f0fdf4',
                                    color: manualMarks[ans.question_id] === true ? 'white' : '#16a34a',
                                    boxShadow: manualMarks[ans.question_id] === true ? '0 4px 12px rgba(22,163,74,0.3)' : 'none',
                                    transition: 'all 0.2s'
                                 }}
                              >
                                 ✓ Mark Correct
                              </button>
                              <button
                                 onClick={() => {
                                    setManualMarks({ ...manualMarks, [ans.question_id]: false });
                                    setScores({ ...scores, [ans.question_id]: 0 });
                                 }}
                                 style={{
                                    padding: '8px 20px', borderRadius: '10px', border: 'none', fontWeight: '800', cursor: 'pointer',
                                    background: manualMarks[ans.question_id] === false ? '#ef4444' : '#fef2f2',
                                    color: manualMarks[ans.question_id] === false ? 'white' : '#ef4444',
                                    boxShadow: manualMarks[ans.question_id] === false ? '0 4px 12px rgba(239,68,68,0.3)' : 'none',
                                    transition: 'all 0.2s'
                                 }}
                              >
                                 ✗ Mark Wrong
                              </button>
                                 </>
                              )}
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            ))}
         </div>

         <style>{`
         .evaluation-module { padding: 40px; max-width: 1000px; margin: 0 auto; }
         .eval-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
         .eval-actions { display: flex; gap: 12px; align-items: center; }
         .locked-badge { display: flex; align-items: center; gap: 8px; background: #f1f5f9; color: var(--secondary); padding: 8px 16px; border-radius: 40px; font-weight: 600; }
         .ans-review-card { padding: 30px; margin-bottom: 24px; border-radius: 16px; }
         .ans-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
         .q-label { font-weight: 700; font-size: 13px; color: var(--secondary); text-transform: uppercase; }
         .score-ctrl input { width: 80px; text-align: center; font-weight: 700; color: var(--primary); border-radius: 8px; border: 1px solid #e2e8f0; padding: 4px; }
         .q-txt { font-weight: 600; margin-bottom: 20px; color: var(--text-main); font-size: 17px; }
         .writing-preview { background: #f8fafc; padding: 20px; border-radius: 12px; line-height: 1.6; white-space: pre-wrap; border: 1px solid var(--border); font-size: 15px; }
         .audio-preview { display: flex; flex-direction: column; gap: 12px; }
         .dl-btn { font-size: 12px; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 4px; margin-top: 8px; }
         .auto-msg { font-size: 12px; color: #16a34a; font-weight: 500; margin-left: 10px; }
       `}</style>
      </div>
   );
   }
};

export default ResultEvaluation;
