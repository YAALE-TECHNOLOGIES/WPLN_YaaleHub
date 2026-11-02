import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Users, Plus, Upload, Search, Settings,
  Trash2, Edit, ChevronDown, Check, X, FileSpreadsheet, Loader2,
  FileText, ClipboardCheck, LayoutDashboard, LogOut, AlertTriangle, Award, TrendingUp, BookOpen, GraduationCap
} from 'lucide-react';
import api from '../api/api';
import ResultEvaluation from './ResultEvaluation';
import ResultEvaluation2 from './ResultEvaluation2';
import QuestionManagement from './QuestionManagement';
import SyllabusManagement from './SyllabusManagement';
import AllocateSet from './AllocateSet';
import Logo from '../assets/Logo.svg';

const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const { showToast } = useToast();
  const isEvaluator = user?.role?.name === 'EVALUATOR';
  const [activeTab, setActiveTab] = useState(isEvaluator ? 'results' : 'users');
  const [userTab, setUserTab] = useState('internal');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({ fullname: '', email: '', password: '', role_id: 3, batch: '', education: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkInputRef = React.useRef(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Global counts for stats
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [candidatesCount, setCandidatesCount] = useState(0);
  const [evaluatorsCount, setEvaluatorsCount] = useState(0);

  // Edit state
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullname: '', email: '', role_id: 3, password: '', batch: '', education: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk upload errors state
  const [bulkErrors, setBulkErrors] = useState([]);
  const [showBulkErrorModal, setShowBulkErrorModal] = useState(false);

  // Search input debouncer (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab, page, pageSize, debouncedSearch, userTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', {
        params: {
          page,
          page_size: pageSize,
          search: debouncedSearch,
          user_tab: userTab
        }
      });
      
      if (res.data && typeof res.data === 'object' && 'items' in res.data) {
        // Edge case: page becomes empty due to deletion of the last item on the last page
        if (res.data.items.length === 0 && res.data.pages > 0 && page > res.data.pages) {
          setPage(res.data.pages);
          return;
        }
        setUsers(res.data.items);
        setTotalCount(res.data.total || 0);
        setTotalUsersCount(res.data.total_users || 0);
        setCandidatesCount(res.data.candidates_count || 0);
        setEvaluatorsCount(res.data.evaluators_count || 0);
        setTotalPages(res.data.pages || 1);
      } else {
        // Backward-compatibility mode fallback (local filtering and pagination)
        const allUsers = res.data || [];
        const filtered = allUsers
          .filter(u => u.fullname.toLowerCase().includes(debouncedSearch.toLowerCase()) || u.email.toLowerCase().includes(debouncedSearch.toLowerCase()))
          .filter(u => userTab === 'internal' ? (u.role_id === 1 || u.role_id === 2) : u.role_id === 3);
        
        setUsers(filtered.slice((page - 1) * pageSize, page * pageSize));
        setTotalCount(filtered.length);
        setTotalUsersCount(allUsers.length);
        setCandidatesCount(allUsers.filter(u => u.role_id === 3).length);
        setEvaluatorsCount(allUsers.filter(u => u.role_id === 2).length);
        setTotalPages(Math.ceil(filtered.length / pageSize) || 1);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    const payload = {
      ...newUser,
      role_id: parseInt(newUser.role_id),
      batch: newUser.role_id === 3 ? (newUser.batch ? parseInt(newUser.batch) : null) : null,
      education: newUser.education || null
    };

    try {
      await api.post('/admin/users', payload);
      setShowAdd(false);
      
      // Automatically switch to the correct tab to show the new user
      if (payload.role_id === 3) {
        setUserTab('candidates');
      } else {
        setUserTab('internal');
      }

      setNewUser({ fullname: '', email: '', password: '', role_id: 3, batch: '', education: '' });
      showToast('User created successfully', 'success');
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
        : (detail || 'Failed to add user');
      showToast(errorMsg, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setBulkUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/admin/users/bulk', formData);
      const errors = res.data.errors || [];
      
      if (errors.length === 0) {
        showToast('Successfully imported all users!', 'success');
        setBulkErrors([]);
        setShowBulkErrorModal(false);
      } else {
        console.error('Bulk upload errors:', errors);
        setBulkErrors(errors);
        setShowBulkErrorModal(true);
        const successCount = res.data.success_count || 0;
        if (successCount > 0) {
          showToast(`Partially completed: ${successCount} users uploaded successfully. Some rows had errors.`, 'warning');
        } else {
          showToast('Import failed. Please review the errors in the spreadsheet.', 'error');
        }
      }
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Bulk upload failed. Please verify that your file format is correct.', 'error');
    } finally {
      setBulkUploading(false);
      if (bulkInputRef.current) bulkInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/admin/users/excel-template', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ fullname: u.fullname, email: u.email, role_id: u.role_id, password: '', batch: u.batch || '', education: u.education || '' });
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload = {
        fullname: editForm.fullname,
        email: editForm.email,
        role_id: parseInt(editForm.role_id),
        batch: editForm.role_id === 3 ? (editForm.batch ? parseInt(editForm.batch) : null) : null,
        education: editForm.education || null,
      };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/admin/users/${editUser.id}`, payload);
      showToast('User updated successfully', 'success');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
        : (detail || 'Failed to update user');
      showToast(errorMsg, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/users/${deleteUser.id}`);
      showToast('User deleted successfully', 'success');
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail)
        ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
        : (detail || 'Failed to delete user');
      showToast(errorMsg, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'results': return <ResultEvaluation />;
      case 'results2': return <ResultEvaluation2 />;
      case 'allocate_set': return <AllocateSet />;
      case 'questions': return <QuestionManagement />;
      case 'syllabus': return <SyllabusManagement />;
      default: return (
        <div className="admin-container fade-in">
          <section className="stats-row">
            <div className="stat-card card">
              <h3>Total Users</h3>
              <p>{totalUsersCount}</p>
            </div>
            <div className="stat-card card">
              <h3>Candidates</h3>
              <p>{candidatesCount}</p>
            </div>
            <div className="stat-card card">
              <h3>Evaluators</h3>
              <p>{evaluatorsCount}</p>
            </div>
          </section>

          <section className="user-management card">
            <div className="table-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '24px', flexWrap: 'wrap' }}>
                <h3>User Management</h3>
                <div className="actions">
                  <div className="search-box">
                    <Search size={18} />
                    <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus size={18} /> Add User</button>
                  <button onClick={downloadTemplate} className="btn-secondary">
                    <FileSpreadsheet size={18} /> Template
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => bulkInputRef.current?.click()}
                    disabled={bulkUploading}
                  >
                    {bulkUploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />}
                    {bulkUploading ? 'Uploading...' : 'Bulk Upload'}
                  </button>
                  <input
                    type="file"
                    ref={bulkInputRef}
                    onChange={handleBulkUpload}
                    accept=".xlsx, .xls, .csv"
                    hidden
                  />
                </div>
              </div>
              <div className="user-tabs" style={{ display: 'flex', gap: '24px', marginTop: '16px', borderBottom: '1px solid #e2e8f0' }}>
                <button
                  className={`tab-btn ${userTab === 'internal' ? 'active' : ''}`}
                  onClick={() => { setUserTab('internal'); setPage(1); }}
                >
                  Admins & Evaluators
                </button>
                <button
                  className={`tab-btn ${userTab === 'candidates' ? 'active' : ''}`}
                  onClick={() => { setUserTab('candidates'); setPage(1); }}
                >
                  Candidates
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    {userTab === 'candidates' && <th>Batch</th>}
                    {userTab === 'candidates' && <th>Education</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={userTab === 'candidates' ? 7 : 5} style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', color: '#64748b' }}>
                          <Loader2 className="spin" size={20} />
                          <span>Loading users...</span>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={userTab === 'candidates' ? 7 : 5} style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                        No users found matching your search.
                      </td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td className="bold">
                          <span 
                            title={u.fullname} 
                            style={{ 
                              display: 'inline-block', 
                              maxWidth: '180px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              verticalAlign: 'middle'
                            }}
                          >
                            {u.fullname}
                          </span>
                        </td>
                        <td>
                          <span 
                            title={u.email} 
                            style={{ 
                              display: 'inline-block', 
                              maxWidth: '220px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              verticalAlign: 'middle'
                            }}
                          >
                            {u.email}
                          </span>
                        </td>
                        <td><span className={`role-badge r-${u.role_id}`}>{u.role_id === 1 ? 'Admin' : u.role_id === 2 ? 'Evaluator' : 'Candidate'}</span></td>
                        {userTab === 'candidates' && <td className="bold">{u.batch || '-'}</td>}
                        {userTab === 'candidates' && <td><span className="education-badge">{u.education || '-'}</span></td>}
                        <td>
                          <div className="row-actions">
                            <button className="icon-btn" title="Edit user" onClick={() => openEdit(u)}><Edit size={16} /></button>
                            <button className="icon-btn danger" title="Delete user" onClick={() => setDeleteUser(u)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Premium Pagination Footer */}
            <div className="pagination-footer">
              <div className="pagination-info">
                Showing <span className="bold">{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                <span className="bold">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                <span className="bold">{totalCount}</span> users
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
          </section>
        </div>
      );
    }
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="logo-area">
          <img src={Logo} alt="Yaale Technologies" className="brand-logo-sidebar" />
          <div className="brand-title-wrap">
            <h2>Skill Bridge</h2>
            <span className="logo-byline">A Product of Yaale Technologies</span>
          </div>
        </div>
        <nav className="side-nav">
          {!isEvaluator && (
            <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>
              <Users size={20} /> User Management
            </button>
          )}
          {!isEvaluator && (
            <button className={activeTab === 'syllabus' ? 'active' : ''} onClick={() => setActiveTab('syllabus')}>
              <BookOpen size={20} /> Upload Syllabus
            </button>
          )}
          <button className={activeTab === 'questions' ? 'active' : ''} onClick={() => setActiveTab('questions')}>
            <FileText size={20} /> Question Bank
          </button>
          <button className={activeTab === 'results' ? 'active' : ''} onClick={() => setActiveTab('results')}>
            <ClipboardCheck size={20} /> Result Evaluation
          </button>
          <button className={activeTab === 'results2' ? 'active' : ''} onClick={() => setActiveTab('results2')}>
            <TrendingUp size={20} /> View Evaluation
          </button>
          <button className={activeTab === 'allocate_set' ? 'active' : ''} onClick={() => setActiveTab('allocate_set')}>
            <GraduationCap size={20} /> Allocate Set
          </button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout} className="logout-btn">
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top-bar glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px' }}>
          <div className="breadcrumb">
            <LayoutDashboard size={18} />
            <span>/ {
              activeTab === 'results2' ? 'View Evaluation' :
                activeTab === 'allocate_set' ? 'Allocate Set' :
                  activeTab === 'results' ? 'Result Evaluation' :
                    activeTab === 'questions' ? 'Question Bank' :
                      activeTab === 'syllabus' ? 'Upload Syllabus' :
                        activeTab === 'users' ? 'User Management' :
                          activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
            }</span>
          </div>
          {user && (
            <div className="top-bar-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                {user.fullname?.charAt(0).toUpperCase()}
              </div>
              <span>{user.fullname}</span>
            </div>
          )}
        </header>
        {renderContent()}
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-card wide fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-icon-box bg-blue">
                <Plus size={24} />
              </div>
              <div className="header-text">
                <h3>Create New User</h3>
                <p>Register a new administrator, evaluator, or candidate.</p>
              </div>
              <button className="close-btn" onClick={() => setShowAdd(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddUser} className="modal-form">
              <div className="form-grid">
                <div className="p-input-group full">
                  <label><Users size={14} /> Full Name</label>
                  <div className="input-with-icon">
                    <input
                      required
                      placeholder="John Doe"
                      value={newUser.fullname}
                      onChange={e => setNewUser({ ...newUser, fullname: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-input-group full">
                  <label><FileText size={14} /> Email Address</label>
                  <div className="input-with-icon">
                    <input
                      type="email"
                      required
                      placeholder="john@example.com"
                      value={newUser.email}
                      onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-input-group">
                  <label><Settings size={14} /> Password</label>
                  <div className="input-with-icon">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="p-input-group">
                  <label><Award size={14} /> Role</label>
                  <select value={newUser.role_id} onChange={e => setNewUser({ ...newUser, role_id: parseInt(e.target.value) })}>
                    <option value="3">Candidate</option>
                    <option value="1">Admin</option>
                  </select>
                </div>

                {newUser.role_id === 3 && (
                  <div className="p-input-group">
                    <label><TrendingUp size={14} /> Batch Number</label>
                    <div className="input-with-icon">
                      <input
                        type="number"
                        min="0"
                        placeholder="2"
                        value={newUser.batch}
                        onChange={e => setNewUser({ ...newUser, batch: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div className="p-input-group">
                  <label><GraduationCap size={14} /> Education</label>
                  <select value={newUser.education} onChange={e => setNewUser({ ...newUser, education: e.target.value })}>
                    <option value="">Select Education</option>
                    <option value="SSE">SSE</option>
                    <option value="HSE">HSE</option>
                    <option value="SSLC">SSLC</option>
                    <option value="Degree">Degree</option>
                    <option value="Master Degree">Master Degree</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary-gradient" disabled={addLoading}>
                  {addLoading ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}
                  {addLoading ? 'Creating...' : 'Create User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-card wide fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-icon-box bg-purple">
                <Edit size={24} />
              </div>
              <div className="header-text">
                <h3>Edit User Profile</h3>
                <p>Update account details for user <strong>#{editUser.id}</strong></p>
              </div>
              <button className="close-btn" onClick={() => setEditUser(null)}><X size={20} /></button>
            </div>

            <form onSubmit={handleEditUser} className="modal-form">
              <div className="form-grid">
                <div className="p-input-group full">
                  <label><Users size={14} /> Full Name</label>
                  <input
                    required
                    value={editForm.fullname}
                    onChange={e => setEditForm({ ...editForm, fullname: e.target.value })}
                  />
                </div>

                <div className="p-input-group full">
                  <label><FileText size={14} /> Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div className="p-input-group">
                  <label><Settings size={14} /> New Password <span className="optional">(blank to keep)</span></label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </div>

                <div className="p-input-group">
                  <label><Award size={14} /> Account Role</label>
                  <select value={editForm.role_id} onChange={e => setEditForm({ ...editForm, role_id: parseInt(e.target.value) })}>
                    <option value="3">Candidate</option>
                    <option value="1">Admin</option>
                  </select>
                </div>

                {editForm.role_id === 3 && (
                  <div className="p-input-group">
                    <label><TrendingUp size={14} /> Batch Number</label>
                    <input
                      type="number"
                      placeholder="2"
                      value={editForm.batch}
                      onChange={e => setEditForm({ ...editForm, batch: e.target.value })}
                    />
                  </div>
                )}

                <div className="p-input-group">
                  <label><GraduationCap size={14} /> Education</label>
                  <select value={editForm.education} onChange={e => setEditForm({ ...editForm, education: e.target.value })}>
                    <option value="">Select Education</option>
                    <option value="SSE">SSE</option>
                    <option value="HSE">HSE</option>
                    <option value="SSLC">SSLC</option>
                    <option value="Degree">Degree</option>
                    <option value="Master Degree">Master Degree</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setEditUser(null)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary-gradient" disabled={editLoading}>
                  {editLoading ? <Loader2 size={18} className="spin" /> : <Check size={18} />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteUser && (
        <div className="modal-overlay" onClick={() => setDeleteUser(null)}>
          <div className="modal-card fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header header-centered">
              <div className="header-icon-box bg-red">
                <AlertTriangle size={32} />
              </div>
              <div className="header-text centered">
                <h3>Delete User?</h3>
                <p>This action will permanently remove <strong>{deleteUser.fullname}</strong> from the system.</p>
              </div>
            </div>

            <div className="modal-body p-32">
              <p className="description-text">
                Are you sure you want to proceed? This will delete all associated test attempts and evaluation history for this user.
              </p>
            </div>

            <div className="modal-footer footer-centered pb-32">
              <button onClick={() => setDeleteUser(null)} className="btn-ghost">Keep User</button>
              <button onClick={handleDeleteUser} className="btn-danger-solid" disabled={deleteLoading}>
                {deleteLoading ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />} Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Upload Error Details Modal ── */}
      {showBulkErrorModal && (
        <div className="modal-overlay" onClick={() => setShowBulkErrorModal(false)}>
          <div className="modal-card wide fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-icon-box bg-red">
                <AlertTriangle size={24} />
              </div>
              <div className="header-text">
                <h3>Bulk Upload Summary</h3>
                <p>Some issues were found in the uploaded Excel file. Please review the row details below.</p>
              </div>
              <button className="close-btn" onClick={() => setShowBulkErrorModal(false)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {bulkErrors.map((err, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ fontSize: '14px', color: '#991b1b', fontWeight: '500' }}>{err}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowBulkErrorModal(false)} className="btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
          .admin-layout { display: flex; min-height: 100vh; background: #f8fafc; font-family: 'Inter', system-ui, -apple-system, sans-serif; overflow-x: hidden; width: 100%; }
          .admin-sidebar { width: 280px; min-width: 280px; flex-shrink: 0; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 50; }
          .logo-area { padding: 32px 24px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #f1f5f9; }
          .logo-circ { width: 36px; height: 36px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
          .logo-area h2 { font-size: 1.25rem; font-weight: 700; color: #1e293b; letter-spacing: -0.02em; }
          
          .side-nav { padding: 24px 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
          .side-nav button { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; color: #64748b; font-weight: 500; transition: all 0.2s; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
          .side-nav button:hover { background: #f1f5f9; color: #1e293b; }
          .side-nav button.active { background: #eff6ff; color: #2563eb; font-weight: 600; }
          
           .admin-layout { display: flex; min-height: 100vh; background: #f8fafc; font-family: 'Inter', system-ui, -apple-system, sans-serif; overflow-x: hidden; width: 100%; }
          .admin-sidebar { width: 280px; min-width: 280px; flex-shrink: 0; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; z-index: 50; }
          .logo-area { padding: 32px 24px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #f1f5f9; }
          .admin-sidebar .logo-area { flex-direction: column; align-items: center; text-align: center; gap: 12px; }
          .brand-logo-sidebar { width: 58px; height: auto; display: block; object-fit: contain; }
          .admin-sidebar .brand-title-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; }
          .logo-area h2 { font-size: 1.25rem; font-weight: 700; color: #1e293b; letter-spacing: -0.02em; margin-bottom: 2px; }
          .logo-byline { font-size: 10px; font-weight: 700; color: #007373; letter-spacing: 0.05em; text-transform: uppercase; }
          
         .side-nav { padding: 24px 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
          .side-nav button { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; color: #64748b; font-weight: 500; transition: all 0.2s; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
          .side-nav button:hover { background: #f1f5f9; color: #1e293b; }
          .side-nav button.active { background: #eaf5f5; color: #007373; font-weight: 600; }

          .sidebar-footer { padding: 20px 16px; border-top: 1px solid #f1f5f9; }
          .logout-btn { display: flex; align-items: center; gap: 12px; color: #ef4444; font-weight: 600; width: 100%; padding: 12px 16px; border-radius: 10px; transition: all 0.2s; cursor: pointer; border: none; background: none; font-size: 14px; }
          .logout-btn:hover { background: #fef2f2; }
          
          .admin-main { flex: 1; background: #f8fafc; min-width: 0; display: flex; flex-direction: column; height: 100vh; overflow-y: auto; }
          .admin-top-bar { flex-shrink: 0; height: 72px; padding: 0 40px; display: flex; align-items: center; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 40; }
          .breadcrumb { display: flex; align-items: center; gap: 10px; color: #64748b; font-weight: 500; font-size: 14px; }
          
          .user-management { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; display: flex; flex-direction: column; }
          .table-scroll { overflow-x: auto; width: 100%; }
          .table-header { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; gap: 24px; }
          .table-header h3 { font-size: 18px; font-weight: 800; color: #1e293b; white-space: nowrap; margin: 0; line-height: 1.2; }

          /* User Management header alignment */
          .user-management .actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
          .user-management .search-box { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; flex: 1 1 260px; max-width: 340px; }
          .user-management .search-box input { border: none; outline: none; background: transparent; font-size: 14px; color: #1e293b; width: 100%; min-width: 140px; }

          .user-management .actions .btn-primary,
          .user-management .actions .btn-secondary { height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 0 18px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; white-space: nowrap; }
          .user-management .actions .btn-primary { background: #007373; border: 1px solid #007373; color: white; box-shadow: 0 10px 15px -3px rgba(0, 115, 115, 0.2); }
          .user-management .actions .btn-primary:hover { filter: brightness(0.98); }
          .user-management .actions .btn-secondary { background: white; border: 1px solid #e2e8f0; color: #334155; }
          .user-management .actions .btn-secondary:hover:not(:disabled) { background: #f8fafc; }
          .user-management .actions button:disabled { opacity: 0.6; cursor: not-allowed; }
          
          .admin-container { padding: 40px; max-width: 1400px; margin: 0 auto; }
          .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px; }
          .stat-card { padding: 24px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .stat-card h3 { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
          .stat-card p { font-size: 32px; font-weight: 700; color: #1e293b; }
          
          /* Modals Professional Styles */
          .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
          .modal-card { background: white; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 500px; overflow: hidden; position: relative; }
          .modal-card.wide { max-width: 600px; }
          
          .modal-header { padding: 32px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: flex-start; gap: 20px; background: linear-gradient(to bottom right, #ffffff, #f8fafc); }
          .header-centered { flex-direction: column; align-items: center; text-align: center; }
          .header-icon-box { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
          .bg-blue { background: linear-gradient(135deg, #008a8a 0%, #007373 100%); box-shadow: 0 8px 16px -4px rgba(0, 138, 138, 0.3); }
          .bg-purple { background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); box-shadow: 0 8px 16px -4px rgba(168, 85, 247, 0.3); }
          .bg-red { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 8px 16px -4px rgba(239, 68, 68, 0.3); }
          
         .header-text h3 { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
          .header-text p { font-size: 14px; color: #64748b; line-height: 1.5; }
          .close-btn { position: absolute; top: 20px; right: 20px; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: none; background: #f1f5f9; color: #64748b; cursor: pointer; transition: all 0.2s; }
          .close-btn:hover { background: #e2e8f0; color: #1e293b; transform: rotate(90deg); }

          .modal-form { padding: 32px; }
          .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .p-input-group { display: flex; flex-direction: column; gap: 8px; }
          .p-input-group.full { grid-column: span 2; }
          .p-input-group label { font-size: 13px; font-weight: 600; color: #475569; display: flex; align-items: center; gap: 8px; }
          
          .p-input-group input, .p-input-group select { padding: 12px 16px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; color: #1e293b; transition: all 0.2s; }
          .p-input-group input:focus, .p-input-group select:focus { background: white; border-color: #007373; outline: none; box-shadow: 0 0 0 4px rgba(0, 115, 115, 0.1); }

          .modal-body { padding: 32px; }
          .p-32 { padding: 32px; }
          .pb-32 { padding-bottom: 32px; }
          .description-text { font-size: 14px; color: #64748b; line-height: 1.6; text-align: center; }
          
         .modal-footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; }
          .footer-centered { justify-content: center; border-top: none; margin-top: 0; }
          
          /* Professional Buttons */
          .btn-primary-gradient { padding: 12px 24px; border-radius: 12px; border: none; background: linear-gradient(135deg, #007373 0%, #005959 100%); color: white; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(0, 115, 115, 0.2); }
          .btn-primary-gradient:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 25px -5px rgba(0, 115, 115, 0.3); }
          .btn-danger-solid { padding: 12px 24px; border-radius: 12px; border: none; background: #ef4444; color: white; font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.2); }
          .btn-danger-solid:hover:not(:disabled) { background: #dc2626; transform: translateY(-2px); }
          .btn-ghost { padding: 12px 24px; border-radius: 12px; background: transparent; border: 1px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; }
          .btn-ghost:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
          
          /* Tables */
         table { width: 100%; border-collapse: collapse; }
          .bold { font-weight: 600; color: #1e293b; }
          .tab-btn { background: none; border: none; padding: 10px 4px; margin-right: 16px; font-weight: 700; font-size: 14px; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
          .tab-btn:hover { color: #1e293b; }
          .tab-btn.active { color: #007373; border-bottom-color: #007373; }
          th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f1f5f9; }
          td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; transition: all 0.2s; }
          tr:hover td { background: #f8fafc; }
          
        .role-badge { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; }
          .r-1 { background: #eaf5f5; color: #007373; }
          .r-2 { background: #f5f3ff; color: #7c3aed; }
          .r-3 { background: #f0fdf4; color: #16a34a; }
          
          .row-actions { display: flex; gap: 8px; }
          .icon-btn { width: 36px; height: 36px; background: #f1f5f9; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer; border: none; color: #64748b; }
          .icon-btn:hover { background: #cceeee; color: #007373; transform: translateY(-2px); }
          .icon-btn.danger:hover { background: #fee2e2; color: #ef4444; }
          .education-badge { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; }
          
          /* Animations */
          .fade-in-up { animation: fadeInUp 0.4s ease-out; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }

          /* Premium Pagination Footer Styles */
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
    </div>
  );
};

export default AdminDashboard;
