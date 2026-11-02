import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck, Clock, CheckCircle, Search,
  MessageSquare, Star, ChevronRight, Loader2, Play, Download
} from 'lucide-react';
import api, { BASE_URL } from '../api/api';
import { useToast } from '../context/ToastContext';

const EvaluatorDashboard = () => {
  const [attempts, setAttempts] = useState([]);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState({}); // questionId: score
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAttempts();
  }, []);

  const fetchAttempts = async () => {
    setLoading(true);
    try {
      // Fetch only completed attempts that need manual evaluation (Writing/Speaking)
      const res = await api.get('/admin/attempts?status=COMPLETED');
      setAttempts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/admin/attempt/${id}`);
      setCurrentAttempt(res.data);
      // Initialize scoring
      const initialScoring = {};
      res.data.answers.forEach(a => {
        initialScoring[a.question_id] = a.marks_obtained || 0;
      });
      setScoring(initialScoring);
    } catch (err) {
      showToast('Failed to load attempt details', 'error');
    }
  };

  const submitEvaluation = async (isLocked = false) => {
    setSaving(true);
    try {
      await api.post(`/admin/evaluate/${currentAttempt.id}`, {
        scores: scoring,
        comments,
        is_locked: isLocked
      });
      showToast(isLocked ? 'Evaluation finalized and locked' : 'Evaluation saved as draft', isLocked ? 'success' : 'info');
      setCurrentAttempt(null);
      fetchAttempts();
    } catch (err) {
      showToast('Evaluation submission failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="eval-wrapper">
      <header className="eval-header glass">
        <div className="title-group">
          <ClipboardCheck size={22} color="#10b981" />
          <h2>Evaluation Management</h2>
        </div>
      </header>

      <main className="eval-container">
        <aside className="attempts-list-side">
          <div className="list-header">
            <h3>Candidate Submissions</h3>
            <span>{attempts.length} Pending</span>
          </div>
          <div className="items">
            {attempts.map(a => (
              <div key={a.id} className={`att-item ${currentAttempt?.id === a.id ? 'active' : ''}`} onClick={() => loadDetail(a.id)}>
                <div className="att-main">
                  <p className="att-name">{a.user_id}</p>
                  <p className="att-mod">{a.module_id}</p>
                </div>
                <ChevronRight size={18} opacity={0.4} />
              </div>
            ))}
            {loading && <Loader2 className="animate-spin" />}
          </div>
        </aside>

        <section className="eval-area">
          {currentAttempt ? (
            <div className="detail-view fade-in">
              <div className="detail-header">
                <div>
                  <h2>{currentAttempt.candidate}</h2>
                  <p>{currentAttempt.module} Assessment</p>
                </div>
                <div className="eval-status">
                  <Clock size={16} /> <span>Submitted: {new Date(currentAttempt.end_time).toLocaleString()}</span>
                </div>
              </div>

              <div className="answers-review">
                {currentAttempt.answers.map((ans, idx) => (
                  <div key={idx} className="ans-card card">
                    <div className="ans-q-info">
                      <span className="q-idx">Question {idx + 1} ({ans.question_type})</span>
                      <div className="scoring-input">
                        <label>Score:</label>
                        <input
                          type="number"
                          value={scoring[ans.question_id]}
                          onChange={(e) => setScoring({ ...scoring, [ans.question_id]: parseFloat(e.target.value) })}
                        />
                        <span className="max-pts">/ Max Marks</span>
                      </div>
                    </div>
                    <p className="q-text-small">{ans.question_text}</p>

                    <div className="ans-content">
                      {ans.question_type === 'WRITING_PROMPT' ? (
                        <div className="writing-box">{ans.text_response}</div>
                      ) : ans.question_type === 'SPEAKING_PROMPT' ? (
                        <div className="audio-player">
                          <audio controls src={`${BASE_URL}/${ans.audio_response}`} />
                          <a href={`${BASE_URL}/${ans.audio_response}`} download className="download-btn"><Download size={16} /> Download Audio</a>
                        </div>
                      ) : (
                        <div className="mcq-review">Selected Option ID: {ans.selected_option} (Auto-evaluated)</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="evaluation-footer card">
                <h3>Overall Feedback</h3>
                <textarea
                  placeholder="Add comments on candidate performance..."
                  className="comments-box"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
                <div className="eval-actions">
                  <button className="btn-secondary" onClick={() => submitEvaluation(false)} disabled={saving}>Save Draft</button>
                  <button className="btn-primary" onClick={() => submitEvaluation(true)} disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" /> : 'Lock & Publish'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <MessageSquare size={80} opacity={0.1} />
              <h3>Select a submission to start evaluation</h3>
              <p>All completed candidate tests will appear in the left panel.</p>
            </div>
          )}
        </section>
      </main>

      <style>{`
         .eval-wrapper { min-height: 100vh; background: #f8fafc; }
         .eval-header { height: 70px; padding: 0 40px; display: flex; align-items: center; border-bottom: 1px solid var(--border); background: white; }
         .eval-container { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 70px); }
         .attempts-list-side { background: white; border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
         .list-header { padding: 24px; border-bottom: 1px solid #f1f5f9; }
         .list-header h3 { font-size: 16px; margin-bottom: 4px; }
         .list-header span { font-size: 13px; color: var(--secondary); font-weight: 500; }
         .items { flex: 1; overflow-y: auto; padding: 12px; }
         .att-item { padding: 16px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; transition: all 0.2s; }
         .att-item:hover { background: #f8fafc; }
         .att-item.active { background: #eaf5f5; color: var(--primary); }
         .att-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
         .att-mod { font-size: 12px; color: var(--secondary); }
         .eval-area { padding: 40px; overflow-y: auto; }
         .detail-view { max-width: 900px; margin: 0 auto; }
         .detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
         .eval-status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--secondary); background: #f1f5f9; padding: 8px 16px; border-radius: 40px; }
         .ans-card { margin-bottom: 24px; padding: 30px; }
         .ans-q-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
         .q-idx { font-weight: 700; font-size: 14px; color: var(--secondary); }
         .scoring-input { display: flex; align-items: center; gap: 12px; }
         .scoring-input input { width: 80px; text-align: center; font-weight: 700; color: var(--primary); }
         .max-pts { color: var(--secondary); font-size: 13px; font-weight: 500; }
         .q-text-small { font-weight: 500; margin-bottom: 20px; line-height: 1.6; }
         .writing-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 24px; line-height: 1.8; white-space: pre-wrap; font-family: 'Inter', sans-serif; }
         .audio-player { display: flex; flex-direction: column; gap: 16px; }
         .audio-player audio { width: 100%; border-radius: 40px; }
         .download-btn { font-size: 13px; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 6px; }
         .evaluation-footer { padding: 40px; margin-top: 40px; }
         .comments-box { width: 100%; height: 120px; margin: 20px 0; padding: 16px; resize: none; }
         .eval-actions { display: flex; justify-content: flex-end; gap: 16px; }
         .empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--secondary); opacity: 0.6; }
         .empty-state h3 { margin: 20px 0 8px; }
       `}</style>
    </div>
  );
};

export default EvaluatorDashboard;
