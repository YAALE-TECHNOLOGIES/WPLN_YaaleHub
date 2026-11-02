import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Loader2, Check, RotateCcw } from 'lucide-react';
import api from '../api/api';

const QUESTION_SETS = ['set1', 'set2', 'set3', 'set4', 'set5'];

const getSetLabel = (setId) => {
  if (!setId) return 'Set 1';
  const normalized = String(setId).toLowerCase().trim();
  if (normalized.startsWith('set')) {
    const num = parseInt(normalized.replace('set', ''), 10);
    return Number.isNaN(num) ? setId : `Set ${num}`;
  }
  return setId;
};

const AllocateSet = () => {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchCandidates();
  }, [page, pageSize, debouncedSearch]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/candidate-evaluations', {
        params: {
          page,
          page_size: pageSize,
          search: debouncedSearch
        }
      });
      const data = res.data?.items || res.data || [];
      setCandidates(data);
      setTotalCount(res.data?.total || data.length || 0);
      setTotalPages(res.data?.pages || 1);
      const initialAllocations = {};
      data.forEach((candidate) => {
        initialAllocations[candidate.user_id] = candidate.assigned_set || 'set1';
      });
      setAllocations(initialAllocations);
    } catch {
      showToast('Failed to load candidate allocations', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAllocationChange = (userId, nextValue) => {
    setAllocations((prev) => ({ ...prev, [userId]: nextValue }));
  };

  const handleSaveAllocation = async (candidate, isReset = false) => {
    const selectedSet = allocations[candidate.user_id];
    
    // If not resetting, we need a change to save
    if (!isReset && (!selectedSet || selectedSet === (candidate.assigned_set || 'set1'))) {
      return;
    }

    if (isReset && !window.confirm(`Are you sure you want to clear all progress for ${candidate.candidate_name} on ${getSetLabel(selectedSet)}? This cannot be undone.`)) {
      return;
    }

    setSavingId(candidate.user_id);
    try {
      await api.put(`/admin/users/${candidate.user_id}`, { 
        assigned_set: selectedSet,
        reset_progress: isReset 
      });
      const actionLabel = isReset ? 'Reallocated' : 'Allocated';
      showToast(`${actionLabel} ${getSetLabel(selectedSet)} for ${candidate.candidate_name}`, 'success');
      fetchCandidates();
    } catch {
      showToast(`Failed to ${isReset ? 'reallocate' : 'allocate'} set. Please try again.`, 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-container fade-in">
      <section className="page-heading">
        <div>
          <h2>Allocate Sets</h2>
        </div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3>Candidate Allocation</h3>
          </div>
          <div style={{ minWidth: '280px', width: '100%', maxWidth: '360px' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by candidate name or email"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569' }}>
            No candidates found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: '200px', width: '200px' }}>Candidate Name</th>
                  <th style={{ textAlign: 'left', minWidth: '140px', width: '140px' }}>Modules</th>
                  <th style={{ textAlign: 'left', minWidth: '170px', width: '170px' }}>Allocate Set</th>
                  <th style={{ textAlign: 'left', minWidth: '150px', width: '150px' }}>Status</th>
                  <th style={{ textAlign: 'left', minWidth: '160px', width: '160px' }}></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => {
                  const currentSet = candidate.assigned_set || 'set1';
                  const selectedValue = allocations[candidate.user_id] || currentSet;
                  const canSave = selectedValue !== currentSet;

                  return (
                    <tr key={candidate.user_id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '16px 12px', minWidth: '200px', width: '200px' }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{candidate.candidate_name}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{candidate.candidate_email}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: 700 }}>{candidate.completed_modules} / {candidate.total_modules}</div>
                        <div style={{ fontSize: '13px', color: '#475569' }}>{candidate.completed_modules >= candidate.total_modules ? 'Completed current set' : 'In progress'}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <select
                            value={selectedValue}
                            onChange={(e) => handleAllocationChange(candidate.user_id, e.target.value)}
                            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', minWidth: '110px' }}
                          >
                            {QUESTION_SETS.map((s) => (
                              <option key={s} value={s}>{getSetLabel(s)}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', verticalAlign: 'middle', minWidth: '160px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', borderRadius: '999px', background: candidate.completed_modules >= candidate.total_modules ? '#d1fae5' : '#fef3c7', color: candidate.completed_modules >= candidate.total_modules ? '#166534' : '#92400e', fontWeight: 700, fontSize: '13px', lineHeight: 1, whiteSpace: 'nowrap' }}>
                          {candidate.completed_modules >= candidate.total_modules ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', minWidth: '160px', width: '160px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleSaveAllocation(candidate)}
                            disabled={!canSave || savingId === candidate.user_id}
                            className="btn-primary"
                            style={{ padding: '10px 12px', borderRadius: '10px', fontSize: '13px', minWidth: '90px', width: '90px' }}
                          >
                            {savingId === candidate.user_id ? <Loader2 className="animate-spin" size={16} /> : <><Check size={14} /> Save</>}
                          </button>
                          
                          <button
                            onClick={() => handleSaveAllocation(candidate, true)}
                            disabled={savingId === candidate.user_id}
                            style={{ 
                              padding: '10px 12px', 
                              borderRadius: '10px', 
                              fontSize: '13px', 
                              minWidth: '40px', 
                              width: '40px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              gap: '6px', 
                              border: '1px solid #ef4444', 
                              background: '#fff', 
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; }}
                          >
                            <RotateCcw size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pagination-footer">
              <div className="pagination-info">
                Showing <span className="bold">{candidates.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
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
                <select value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                </select>
                <span>per page</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

      <style>{`
        .pagination-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid #f1f5f9; background: #ffffff; flex-wrap: wrap; gap: 16px; }
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
        .page-size-selector select:focus { border-color: #007373; background: white; }
      `}</style>
export default AllocateSet;
