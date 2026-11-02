import React, { useState, useEffect } from 'react';
import {
    Upload, FileText, Trash2, Plus,
    Search, Loader2, File, CheckCircle2, AlertCircle,
    Download, ExternalLink, BookOpen, Clock, FileType, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { BASE_URL } from '../api/api';
import { useToast } from '../context/ToastContext';

const SyllabusManagement = () => {
    const [loading, setLoading] = useState(true);
    const [syllabusList, setSyllabusList] = useState([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { showToast } = useToast();

    // Pagination states
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Form state
    const [title, setTitle] = useState('');
    const [file, setFile] = useState(null);
    const [editId, setEditId] = useState(null);

    // Search input debouncer (300ms)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        fetchSyllabus();
    }, [page, pageSize, debouncedSearch]);

    const fetchSyllabus = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/syllabus', {
                params: {
                    page,
                    page_size: pageSize,
                    search: debouncedSearch
                }
            });
            
            if (res.data && typeof res.data === 'object' && 'items' in res.data) {
                setSyllabusList(res.data.items);
                setTotalCount(res.data.total || 0);
                setTotalPages(res.data.pages || 1);
            } else {
                setSyllabusList(res.data || []);
                setTotalCount(res.data?.length || 0);
                setTotalPages(1);
            }
        } catch (err) {
            showToast('Failed to load syllabus list', 'error');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (item) => {
        setEditId(item.id);
        setTitle(item.title);
        setFile(null);
        setShowUpload(true);
    };

    const openUploadModal = () => {
        setEditId(null);
        setTitle('');
        setFile(null);
        setShowUpload(true);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title.trim() || (!file && !editId)) {
            showToast('Please provide a title and select a file', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        if (file) formData.append('file', file);

        setUploading(true);
        try {
            if (editId) {
                await api.put(`/admin/syllabus/${editId}`, formData);
                showToast('Syllabus updated successfully', 'success');
            } else {
                await api.post('/admin/syllabus', formData);
                showToast('Syllabus uploaded successfully', 'success');
            }
            setShowUpload(false);
            setTitle('');
            setFile(null);
            setEditId(null);
            fetchSyllabus();
        } catch (err) {
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail) 
                ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ') 
                : (detail || 'Action failed');
            showToast(errorMsg, 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this syllabus?')) return;

        try {
            await api.delete(`/admin/syllabus/${id}`);
            showToast('Syllabus deleted successfully', 'success');
            fetchSyllabus();
        } catch (err) {
            showToast('Failed to delete syllabus', 'error');
        }
    };

    const getFileIcon = (type) => {
        if (type?.includes('pdf')) return <div className="file-icon-box pdf"><FileText size={20} /></div>;
        return <div className="file-icon-box word"><File size={20} /></div>;
    };

    const displayList = syllabusList;

    return (
        <div className="syllabus-management-page fade-in">
            <header className="page-header">
                <div className="header-info">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="premium-title"
                    >
                        Syllabus Management
                    </motion.h1>
                    <p className="subtitle">Curate and distribute the curriculum documents for your candidates.</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.02, translateY: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={openUploadModal}
                    className="premium-add-btn"
                >
                    <Plus size={20} /> Upload New Document
                </motion.button>
            </header>

            <section className="analytics-summary">
                <div className="summary-card">
                    <div className="card-icon blue"><BookOpen size={24} /></div>
                    <div className="card-data">
                        <span className="label">Total Documents</span>
                        <span className="value">{syllabusList.length}</span>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="card-icon purple"><Clock size={24} /></div>
                    <div className="card-data">
                        <span className="label">Last Updated</span>
                        <span className="value">{syllabusList.length > 0 ? new Date(syllabusList[0].created_at).toLocaleDateString() : 'N/A'}</span>
                    </div>
                </div>
            </section>

            <div className="content-card">
                <div className="card-header">
                    <div className="search-wrapper">
                        <Search size={18} />
                        <input
                            placeholder="Filter by title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="table-container">
                    <table className="premium-table">
                        <thead>
                            <tr>
                                <th>Document Details</th>
                                <th>Format</th>
                                <th>Upload Date</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {displayList.length > 0 ? displayList.map((item, idx) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <td>
                                            <div className="doc-info">
                                                {getFileIcon(item.file_type)}
                                                <div className="doc-text">
                                                    <span className="doc-title">{item.title}</span>
                                                    <span className="doc-path">/uploads/syllabus/...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`format-badge ${item.file_type?.includes('pdf') ? 'pdf' : 'doc'}`}>
                                                {item.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="date-box">
                                                <Clock size={14} />
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <motion.button
                                                    whileHover={{ y: -2 }}
                                                    onClick={() => openEditModal(item)}
                                                    className="action-btn edit"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </motion.button>
                                                <motion.a
                                                    whileHover={{ y: -2 }}
                                                    href={`${BASE_URL}/${item.file_path}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="action-btn view"
                                                    title="View Document"
                                                >
                                                    <ExternalLink size={16} />
                                                </motion.a>
                                                <motion.button
                                                    whileHover={{ y: -2 }}
                                                    onClick={() => handleDelete(item.id)}
                                                    className="action-btn delete"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </motion.button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="empty-state">
                                            {loading ? <Loader2 className="animate-spin" size={32} /> : (
                                                <div className="empty-content">
                                                    <FileType size={48} className="opacity-10" />
                                                    <p>No documents found matching your criteria.</p>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {/* Premium Pagination Footer */}
                <div className="pagination-footer">
                   <div className="pagination-info">
                      Showing <span className="bold">{displayList.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                      <span className="bold">{Math.min(page * pageSize, totalCount)}</span> of{' '}
                      <span className="bold">{totalCount}</span> documents
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

            {/* Premium Upload Modal */}
            <AnimatePresence>
                {showUpload && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="modal-overlay"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="premium-modal"
                        >
                            <div className="modal-top">
                                <div className="modal-icon"><Upload size={24} /></div>
                                <h2>{editId ? 'Edit Syllabus' : 'Upload Syllabus'}</h2>
                                <p>{editId ? 'Update title or optionally upload a new curriculum file.' : 'Provide a title and select a curriculum file to upload.'}</p>
                            </div>

                            <form onSubmit={handleUpload} className="modal-body">
                                <div className="input-group">
                                    <label>Document Title</label>
                                    <input
                                        required
                                        placeholder="e.g. Advanced English Syllabus 2025"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                </div>

                                <div className="drop-zone-wrapper">
                                    <label>File Selection</label>
                                    <div className={`drop-zone ${file ? 'has-file' : ''}`}>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => setFile(e.target.files[0])}
                                        />
                                        <Upload size={32} />
                                        {file ? (
                                            <div className="file-details">
                                                <p className="file-name">{file.name}</p>
                                                <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <div className="zone-text">
                                                <p>Click to browse or drag & drop</p>
                                                <span>{editId ? 'Leave blank to keep existing file' : 'PDF or Word files only'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" onClick={() => setShowUpload(false)} className="btn-cancel">Cancel</button>
                                    <button type="submit" disabled={uploading} className="btn-submit">
                                        {uploading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                        {uploading ? 'Processing...' : (editId ? 'Save Changes' : 'Complete Upload')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .syllabus-management-page { padding: 40px; max-width: 1200px; margin: 0 auto; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
                .premium-title { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
                .subtitle { color: #64748b; font-size: 16px; }
                
                .premium-add-btn { display: flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #007373 0%, #005959 100%); color: white; padding: 14px 28px; border-radius: 14px; font-weight: 700; box-shadow: 0 10px 20px -5px rgba(0, 115, 115, 0.35); }
                
                .analytics-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 40px; }
                .summary-card { background: white; padding: 24px; border-radius: 20px; border: 1px solid #f1f5f9; display: flex; align-items: center; gap: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .card-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; }
                .card-icon.blue { background: #eaf5f5; color: #007373; }
                .card-icon.purple { background: #f5f3ff; color: #7c3aed; }
                .card-data .label { display: block; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 4px; }
                .card-data .value { font-size: 28px; font-weight: 800; color: #1e293b; }

                .content-card { background: white; border-radius: 24px; border: 1px solid #f1f5f9; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); overflow: hidden; }
                .card-header { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; }
                .search-wrapper { display: flex; align-items: center; gap: 12px; background: #f8fafc; border-radius: 12px; padding: 0 16px; width: 100%; max-width: 400px; border: 1px solid transparent; transition: all 0.2s; }
                .search-wrapper:focus-within { background: white; border-color: #007373; box-shadow: 0 0 0 4px rgba(0, 115, 115, 0.08); }
                .search-wrapper input { border: none; background: transparent; padding: 12px 0; outline: none !important; box-shadow: none !important; font-size: 14px; width: 100%; }
                .search-wrapper input:focus { outline: none !important; box-shadow: none !important; border-color: transparent !important; }
                .search-wrapper svg { color: #94a3b8; }

                .table-container { overflow-x: auto; }
                .premium-table { width: 100%; border-collapse: collapse; }
                .premium-table th { text-align: left; padding: 12px 16px; background: #f8fafc; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #f1f5f9; }
                .premium-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
                .premium-table tr:hover td { background: #fbfcfe; }

                .doc-info { display: flex; align-items: center; gap: 16px; }
                .file-icon-box { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .file-icon-box.pdf { background: #fef2f2; color: #ef4444; }
                .file-icon-box.word { background: #eaf5f5; color: #007373; }
                .doc-text { display: flex; flex-direction: column; }
                .doc-title { font-weight: 700; color: #1e293b; font-size: 15px; }
                .doc-path { font-size: 12px; color: #94a3b8; margin-top: 2px; }

                .format-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; }
                .format-badge.pdf { background: #fee2e2; color: #991b1b; }
                .format-badge.doc { background: #d4f3df; color: #0a7b3c; }

                .date-box { display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px; font-weight: 500; }
                .action-btns { display: flex; justify-content: flex-end; gap: 8px; }
                .action-btn { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .action-btn.view { background: #f1f5f9; color: #475569; }
                .action-btn.view:hover { background: #e2e8f0; color: #1e293b; }
                .action-btn.edit { background: #fefce8; color: #a16207; }
                .action-btn.edit:hover { background: #fef08a; color: #854d0e; }
                .action-btn.delete { background: #fef2f2; color: #ef4444; }
                .action-btn.delete:hover { background: #fee2e2; color: #dc2626; }

                .empty-state { padding: 80px 0; text-align: center; }
                .empty-content { display: flex; flex-direction: column; align-items: center; gap: 16px; color: #94a3b8; }

                /* Modal Professional */
                .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
                .premium-modal { background: white; width: 100%; max-width: 500px; border-radius: 32px; box-shadow: 0 40px 60px -15px rgba(0,0,0,0.3); overflow: hidden; }
                .modal-top { padding: 40px; background: linear-gradient(to bottom right, #f8fafc, #ffffff); border-bottom: 1px solid #f1f5f9; text-align: center; }
                .modal-icon { width: 64px; height: 64px; background: #eaf5f5; color: #007373; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
                .modal-top h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
                .modal-top p { color: #64748b; font-size: 14px; line-height: 1.5; }
                
                .modal-body { padding: 40px; }
                .input-group { margin-bottom: 24px; }
                .input-group label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 10px; }
                .input-group input { width: 100%; padding: 14px 18px; border-radius: 14px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 15px; transition: all 0.2s; }
                .input-group input:focus { background: white; border-color: #007373; box-shadow: 0 0 0 4px rgba(0, 115, 115, 0.1); }

                .drop-zone-wrapper label { display: block; font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 10px; }
                .drop-zone { position: relative; height: 160px; border: 2px dashed #e2e8f0; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; transition: all 0.3s; }
                .drop-zone.has-file { border-color: #10b981; background: #f0fdf4; border-style: solid; }
                .drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; z-index: 10; }
                .drop-zone svg { color: #94a3b8; margin-bottom: 12px; transition: all 0.3s; }
                .drop-zone.has-file svg { color: #10b981; transform: scale(1.1); }
                .zone-text { text-align: center; }
                .zone-text p { font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 4px; }
                .zone-text span { font-size: 12px; color: #94a3b8; }
                .file-name { font-size: 14px; font-weight: 800; color: #065f46; margin-bottom: 2px; }
                .file-size { font-size: 11px; color: #059669; font-weight: 600; }

                .modal-footer { margin-top: 40px; display: flex; gap: 12px; }
                .btn-cancel { flex: 1; padding: 14px; border-radius: 14px; background: white; border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; font-size: 15px; }
                .btn-submit { flex: 2; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #007373 0%, #005959 100%); color: white; font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px -5px rgba(0, 115, 115, 0.35); }

                /* Premium Pagination Footer Styles */
                .pagination-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-top: 1px solid #f1f5f9; background: #ffffff; flex-wrap: wrap; gap: 16px; border-bottom-left-radius: 24px; border-bottom-right-radius: 24px; }
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

export default SyllabusManagement;
