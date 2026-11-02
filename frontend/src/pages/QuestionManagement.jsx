import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Edit2, Trash2,
  Loader2, CheckCircle2, XCircle, FileText,
  Type, Layers, Award, Upload, Check, AlertCircle, Clock, Save,
  GripVertical, Mic, ChevronRight, Image, BookOpen, Headphones, Eye, PenTool,
  Download, Table2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

/* ─── helpers ─── */
const getOptionLabel = (idx) => String.fromCharCode(65 + idx);
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']; // Fallback/Legacy
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

const TYPES = [
  { value: 'MCQ', label: 'Multiple Choice (MCQ)' },
  { value: 'AUDIO_MCQ', label: 'Listening / Audio MCQ' },
  { value: 'WRITING_PROMPT', label: 'Writing Prompt' },
  { value: 'SPEAKING_PROMPT', label: 'Speaking Prompt' },
  { value: 'DRAG_DROP_ORDERING', label: 'Drag & Drop (Ordering)' },
  { value: 'DRAG_DROP_SLOTS', label: 'Drag & Drop (Slots)' },
  { value: 'QUESTION_FORM', label: 'Question Form' },
];

const makeBlankQuestion = (idx = 0, defaultType = 'MCQ', defaultSet = 'set1') => ({
  _id: `q-${Date.now()}-${idx}`,
  question_type: defaultType,
  question_text: '',
  marks: 10,
  recording_duration: isSpeaking(defaultType) ? 30 : null,
  display_type: 'click',
  question_set: defaultSet,
  options: [
    { option_text: '', explanation: '', is_correct: true },
    { option_text: '', explanation: '', is_correct: false },
    { option_text: '', explanation: '', is_correct: false },
  ],
  audio_script: '',
  audio_file: null,
  drag_drop_data: {
    drag_items: ['Item 1'],
    drop_zones: ['Zone 1'],
    correct_mapping: { "0": 0 }, // index-based mapping
    fixed_sentence: '', // For ordering
    items: [{ text: 'Sentence 1', order: 1 }] // For ordering with manual rank
  }
});

const isMCQ = (t) => t === 'MCQ' || t === 'AUDIO_MCQ';
const isSpeaking = (t) => t === 'SPEAKING_PROMPT';
const isListening = (t) => t === 'AUDIO_MCQ';
const isDragDropOrdering = (t) => t === 'DRAG_DROP_ORDERING';
const isDragDropSlots = (t) => t === 'DRAG_DROP_SLOTS';
const isDragDropAny = (t) => t === 'DRAG_DROP_ORDERING' || t === 'DRAG_DROP_SLOTS';
const isQuestionForm = (t) => t === 'QUESTION_FORM';
const isPromptMode = (q) => {
  if (!q) return false;
  const t = q.question_type;
  return t === 'QUESTION_FORM' || (t === 'AUDIO_MCQ' && q.display_type === 'prompt');
};
const isSpeakingMod = (mod) => {
  if (!mod) return false;
  return mod.name?.toLowerCase().includes('speaking') || mod.module_type === 'speaking';
};

const groupQuestions = (questionsList) => {
  if (!questionsList || questionsList.length === 0) return [];

  const groupsMap = {};
  const standaloneQuestions = [];

  questionsList.forEach((q) => {
    const gid = q.group_id;
    // Normalize null/None and empty strings
    const isValidGroup = gid && gid !== 'None' && gid !== 'null' && String(gid).trim() !== '';

    if (isValidGroup) {
      if (!groupsMap[gid]) {
        groupsMap[gid] = {
          id: `group-${q.id || q._id}`,
          group_id: gid,
          is_grouped: true,
          question_forms: [],
          questions: [],
          marks: 0,
          order_index: q.order_index ?? 0
        };
      }
      if (isPromptMode(q)) {
        groupsMap[gid].question_forms.push(q);
      } else {
        groupsMap[gid].questions.push(q);
        groupsMap[gid].marks += q.marks || 0;
      }
      
      // Track minimum order_index for group sorting
      if ((q.order_index ?? 0) < groupsMap[gid].order_index) {
        groupsMap[gid].order_index = q.order_index ?? 0;
      }
    } else {
      standaloneQuestions.push(q);
    }
  });

  // Convert groups map to array and sort inner components
  const groupsList = [];
  Object.values(groupsMap).forEach((g) => {
    // If a group has NO prompt forms (e.g., added as a standalone question or batch of questions
    // without a Question Form context) AND contains at most 1 question, unpack all its questions to show them standalone!
    // If it has 2 or more questions, we keep them combined together as a group!
    if (g.question_forms.length === 0 && g.questions.length <= 1) {
      standaloneQuestions.push(...g.questions);
      return;
    }

    // Sort prompts by order_index, then id
    g.question_forms.sort((a, b) => {
      if ((a.order_index ?? 0) !== (b.order_index ?? 0)) {
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      }
      return a.id - b.id;
    });
    // Sort child questions by order_index, then id
    g.questions.sort((a, b) => {
      if ((a.order_index ?? 0) !== (b.order_index ?? 0)) {
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      }
      return a.id - b.id;
    });
    groupsList.push(g);
  });

  const allProcessed = [...groupsList, ...standaloneQuestions];

  // Sort final items by order_index, then ID of first prompt or standalone question
  return allProcessed.sort((a, b) => {
    const aOrder = a.is_grouped ? a.order_index : (a.order_index ?? 0);
    const bOrder = b.is_grouped ? b.order_index : (b.order_index ?? 0);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    const aId = a.is_grouped ? (a.question_forms[0]?.id || 0) : (a.id || 0);
    const bId = b.is_grouped ? (b.question_forms[0]?.id || 0) : (b.id || 0);
    return aId - bId;
  });
};

/* ─── Sortable Question Block ─── */
function SortableQuestionBlock({ q, idx, total, onChange, onRemove, onAudioChange, isSpeakingModule }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const setCorrect = (optIdx) => {
    const opts = q.options.map((o, i) => ({ ...o, is_correct: i === optIdx }));
    onChange({ ...q, options: opts });
  };

  const addOption = () => {
    const opts = [...q.options, { option_text: '', explanation: '', is_correct: false }];
    onChange({ ...q, options: opts });
  };

  const removeOption = (optIdx) => {
    if (q.options.length <= 2) return;
    const isRemovingCorrect = q.options[optIdx].is_correct;
    const opts = q.options.filter((_, i) => i !== optIdx);
    if (isRemovingCorrect && opts.length > 0) {
      opts[0].is_correct = true;
    }
    onChange({ ...q, options: opts });
  };


  const updateOptText = (optIdx, text) => {
    const opts = [...q.options];
    opts[optIdx] = { ...opts[optIdx], option_text: text };
    onChange({ ...q, options: opts });
  };

  const updateOptExplanation = (optIdx, text) => {
    const opts = [...q.options];
    opts[optIdx] = { ...opts[optIdx], explanation: text };
    onChange({ ...q, options: opts });
  };

  const correctIdx = q.options.findIndex((o) => o.is_correct);

  return (
    <div ref={setNodeRef} style={style} className="qb-block card">
      {/* Block header */}
      <div className="qb-header">
        <div className="qb-drag-handle" {...attributes} {...listeners}>
          <GripVertical size={20} />
        </div>
        <span className="qb-num">Question {idx + 1}</span>
        <div className="qb-type-pills">
          {TYPES.filter(t => isSpeakingModule ? t.value === 'SPEAKING_PROMPT' : t.value !== 'SPEAKING_PROMPT').map((t) => (
            <button
              key={t.value}
              type="button"
              className={`qb-type-pill ${q.question_type === t.value ? 'active' : ''}`}
              onClick={() => onChange({ ...q, question_type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {total > 1 && (
          <button type="button" className="qb-remove" onClick={() => onRemove(q._id)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Question text */}
      <div className="qb-body">
        <div className="p-input-group">
          <label><Type size={14} /> Question Text (Visible to Candidate)</label>
          <textarea
            placeholder="Enter the question text here..."
            value={q.question_text}
            onChange={(e) => onChange({ ...q, question_text: e.target.value })}
          />
        </div>

        {isListening(q.question_type) && (
          <div className="p-input-group">
            <label><Mic size={14} /> Audio Script (TTS - Hidden from Candidate)</label>
            <textarea
              placeholder="Enter text to be read aloud via TTS. If empty, Question Text will be used."
              value={q.audio_script}
              onChange={(e) => onChange({ ...q, audio_script: e.target.value })}
              style={{ minHeight: '80px', borderLeft: '4px solid #008a8a' }}
            />
          </div>
        )}

        {!isPromptMode(q) && (
          <div className="qb-row-meta">
            <div className="p-input-group" style={{ flex: 1 }}>
              <label><Award size={14} /> Marks</label>
              <input
                type="number"
                min="1"
                value={q.marks}
                onChange={(e) => onChange({ ...q, marks: e.target.value === '' ? '' : parseInt(e.target.value) })}
              />
            </div>

            <div className="p-input-group" style={{ flex: 1 }}>
              <label><Layers size={14} /> Question Set</label>
              <select
                value={q.question_set || 'set1'}
                onChange={(e) => onChange({ ...q, question_set: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                {QUESTION_SETS.map((setId) => (
                  <option key={setId} value={setId}>{getSetLabel(setId)}</option>
                ))}
              </select>
            </div>

            {/* Speaking: duration field */}
            {isSpeaking(q.question_type) && (
              <div className="p-input-group" style={{ flex: 1 }}>
                <label><Mic size={14} /> Recording Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  value={q.recording_duration}
                  onChange={(e) => onChange({ ...q, recording_duration: parseInt(e.target.value) || 30 })}
                  required
                />
              </div>
            )}
          </div>
        )}

        {/* Listening: audio upload */}
        {/* MCQ: media upload */}
        {(q.question_type === 'MCQ' || q.question_type === 'AUDIO_MCQ' || q.question_type === 'WRITING_PROMPT' || q.question_type === 'SPEAKING_PROMPT') && !isPromptMode(q) && (
          <div className="p-input-group" style={{ marginBottom: 16 }}>
            <label style={{ color: '#475569', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Image size={14} />
              Question Media (Image/Icon)
            </label>
            <div className="p-file-dropzone" style={{ border: '1px dashed #cbd5e1', borderRadius: 8, padding: '12px', background: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="file"
                accept="image/*"
                id={`media-${q._id}`}
                onChange={(e) => onAudioChange(q._id, e.target.files[0])}
                style={{ display: 'none' }}
              />
              <label htmlFor={`media-${q._id}`} style={{ cursor: 'pointer', display: 'block' }}>
                {q.audio_file ? (
                  <div className="file-ready" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#059669', fontSize: 13 }}>
                    <CheckCircle2 size={20} /><span>{q.audio_file.name}</span>
                  </div>
                ) : (
                  <div className="file-empty" style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b', fontSize: 13 }}>
                    <Upload size={20} /><span>Upload Media</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* MCQ options */}
        {isMCQ(q.question_type) && !isPromptMode(q) && (
          <div className="qb-options">
            {q.display_type === 'writing' ? (
              <div className="writing-mode-placeholder" style={{ padding: '20px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center', marginBottom: 16 }}>
                <p style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                  <Edit2 size={16} style={{ marginBottom: 4 }} /><br />
                  Writing Mode Enabled: Candidate will type their answer.
                </p>
                <button type="button" onClick={() => onChange({ ...q, display_type: 'click' })} className="btn-secondary-sm" style={{ marginTop: 8 }}>
                  Switch to MCQ
                </button>
              </div>
            ) : (
              <>
                <div className="options-header">
              <CheckCircle2 size={16} /> <h4>Answer Options</h4>
              <span className="opts-select-hint">
                Correct:&nbsp;
                <select
                  value={correctIdx >= 0 ? getOptionLabel(correctIdx) : 'A'}
                  onChange={(e) => setCorrect(e.target.selectedIndex)}
                  className="correct-select"
                >
                  {q.options.map((_, i) => <option key={i} value={getOptionLabel(i)}>{getOptionLabel(i)}</option>)}
                </select>
              </span>
            </div>

            <div className="options-list">
              {q.options.map((o, oi) => (
                  <div className="p-option-container" style={{ marginBottom: '12px' }}>
                    <div className={`p-option-row ${o.is_correct ? 'is-correct' : ''}`} style={{ marginBottom: '4px' }}>
                      <span className="opt-label">{getOptionLabel(oi)}</span>
                      <input
                        type="text"
                        value={o.option_text}
                        onChange={(e) => updateOptText(oi, e.target.value)}
                        placeholder={`Option ${getOptionLabel(oi)} text`}
                        required
                        style={{ flex: 1 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {o.is_correct && <Check size={14} className="opt-check" />}
                        {q.options.length > 2 && (
                          <button type="button" onClick={() => removeOption(oi)} className="btn-icon-danger" title="Remove Option" style={{ padding: '4px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {q.question_type !== 'AUDIO_MCQ' && (
                      <div className="opt-explanation-row" style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={12} style={{ color: '#64748b' }} />
                        <input
                          type="text"
                          value={o.explanation || ''}
                          onChange={(e) => updateOptExplanation(oi, e.target.value)}
                          placeholder={`Reason why this is ${o.is_correct ? 'correct' : 'incorrect'}...`}
                          style={{ flex: 1, fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                        />
                      </div>
                    )}
                  </div>
              ))}
            </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              {q.display_type !== 'writing' && (
                <button type="button" className="btn-add-sm" onClick={addOption}>
                  <Plus size={14} /> Add Option
                </button>
              )}
              <div style={{ flex: 1 }} />

              <div className="options-display-mode" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#64748b' }}>
                <label>Answer Display Type:</label>
                <select
                  value={q.display_type || 'click'}
                  onChange={(e) => onChange({ ...q, display_type: e.target.value })}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600 }}
                >
                  <option value="click">Click (Radio Buttons)</option>
                  <option value="select">Select (Dropdown)</option>
                  {q.question_type === 'AUDIO_MCQ' && (
                    <option value="prompt">Without (Prompt/Instruction)</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Speaking info box */}
        {isSpeaking(q.question_type) && (
          <div className="p-prompt-info">
            <Mic size={32} />
            <p>Candidates will record an audio response. No options required.</p>
          </div>
        )}

        {/* Writing info box */}
        {q.question_type === 'WRITING_PROMPT' && (
          <div className="p-prompt-info">
            <FileText size={32} />
            <p>Candidates will write a long-form text response. No options required.</p>
          </div>
        )}

        {/* Question Form / Prompt info box */}
        {isPromptMode(q) && (
          <div className="p-prompt-info">
            {q.question_type === 'AUDIO_MCQ' ? <Headphones size={32} /> : <Type size={32} />}
            <p>
              {q.question_type === 'AUDIO_MCQ' 
                ? "This is an audio instruction block. It will play the audio script but won't require an answer."
                : "This is a text-only prompt. Only the Question Text will be displayed."}
            </p>
          </div>
        )}

        {/* Drag & Drop Ordering/Slots Config */}
        {isDragDropAny(q.question_type) && (
          <div className="qb-drag-drop-config" style={{ flexDirection: 'column' }}>
            <div className="dd-config-col" style={{ width: '100%', marginBottom: 15 }}>
              <label className="dd-label-sm">Fixed First Sentence (Optional, not draggable)</label>
              <input
                type="text"
                value={q.drag_drop_data?.fixed_sentence || ''}
                onChange={(e) => onChange({ ...q, drag_drop_data: { ...q.drag_drop_data, fixed_sentence: e.target.value } })}
                placeholder="e.g. This report gives information about the traffic problems..."
              />
            </div>
            <div className="dd-config-col" style={{ width: '100%' }}>
              <label className="dd-label-sm">Sentences Configuration</label>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, marginTop: -5 }}>Enter sentences in any order and select their correct position (1, 2, 3...) using the dropdown.</p>
              {(q.drag_drop_data?.items || []).map((item, idx) => (
                <div key={idx} className="dd-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <select
                    value={item.order || (idx + 1)}
                    onChange={(e) => {
                      const newOrder = parseInt(e.target.value);
                      const newItems = [...(q.drag_drop_data.items || [])];
                      const oldOrder = item.order || (idx + 1);
                      // Find the other item currently occupying the target position to swap
                      const targetIdx = newItems.findIndex((it, i) => (it.order || (i + 1)) === newOrder);
                      if (targetIdx !== -1 && targetIdx !== idx) {
                        newItems[targetIdx] = { ...newItems[targetIdx], order: oldOrder };
                      }
                      newItems[idx] = { ...newItems[idx], order: newOrder };
                      onChange({ ...q, drag_drop_data: { ...q.drag_drop_data, items: newItems } });
                    }}
                    style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800', width: '55px', background: '#f8fafc' }}
                  >
                    {Array.from({ length: q.drag_drop_data.items.length }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                  <input type="text" value={item.text} onChange={(e) => {
                    const newItems = [...(q.drag_drop_data.items || [])];
                    newItems[idx] = { ...newItems[idx], text: e.target.value };
                    onChange({ ...q, drag_drop_data: { ...q.drag_drop_data, items: newItems } });
                  }} placeholder="Enter sentence..." style={{ flex: 1 }} />
                  <button type="button" onClick={() => {
                    const newItems = q.drag_drop_data.items.filter((_, i) => i !== idx);
                    onChange({ ...q, drag_drop_data: { ...q.drag_drop_data, items: newItems } });
                  }} className="btn-icon-danger"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn-add-sm" onClick={() => {
                const nextOrder = (q.drag_drop_data.items || []).length + 1;
                onChange({ ...q, drag_drop_data: { ...q.drag_drop_data, items: [...(q.drag_drop_data.items || []), { text: '', order: nextOrder }] } });
              }}><Plus size={14} /> Add Sentence</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
const QuestionManagement = () => {
  const { showToast } = useToast();
  const [modules, setModules] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState('set1');
  const [questions, setQuestions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const excelInputRef = useRef(null);

  const filteredQuestions = questions.filter((q) => (q.question_set || 'set1') === selectedQuestionSet);

  /* bulk builder state */
  const [builderQs, setBuilderQs] = useState([makeBlankQuestion(0, isSpeakingMod(selectedModule) ? 'SPEAKING_PROMPT' : 'MCQ')]);

  /* edit state */
  const [editQ, setEditQ] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [originalGroupQs, setOriginalGroupQs] = useState([]);

  const [moduleSettings, setModuleSettings] = useState({
    pass_marks: 50, duration_minutes: 30, total_marks: 100, description: '', proficiency_mapping: []
  });

  /* dnd sensors */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { fetchModules(); }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/candidate/modules');
      setModules(res.data);
      if (res.data.length > 0 && !selectedModule) handleModuleClick(res.data[0]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleModuleClick = async (mod) => {
    setSelectedModule(mod);
    setSelectedQuestionSet('set1');
    setModuleSettings({
      pass_marks: mod.pass_marks || 50,
      duration_minutes: mod.duration_minutes || 30,
      total_marks: mod.total_marks || 100,
      description: mod.description || '',
      begin_speaking_audio_url: mod.begin_speaking_audio_url || null,
      speaking_recording_duration: mod.speaking_recording_duration || 30,
      module_type: mod.module_type || 'reading',
      proficiency_mapping: mod.proficiency_mapping || []
    });
    setLoading(true);
    try {
      const res = await api.get(`/admin/questions/${mod.id}?t=${Date.now()}`);
      setQuestions(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  /* ── Builder helpers ── */
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setBuilderQs((items) => {
        const oldIndex = items.findIndex((i) => i._id === active.id);
        const newIndex = items.findIndex((i) => i._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addQuestion = () => {
    const defaultType = isSpeakingMod(selectedModule) ? 'SPEAKING_PROMPT' : 'MCQ';
    setBuilderQs((prev) => [...prev, makeBlankQuestion(prev.length, defaultType, selectedQuestionSet || 'set1')]);
  };

  const removeQuestion = (id) => {
    setBuilderQs((prev) => prev.filter((q) => q._id !== id));
  };

  const updateQuestion = useCallback((updated) => {
    setBuilderQs((prev) => prev.map((q) => (q._id === updated._id ? updated : q)));
  }, []);

  const handleAudioChange = useCallback((id, file) => {
    setBuilderQs((prev) => prev.map((q) => q._id === id ? { ...q, audio_file: file } : q));
  }, []);

  /* ── Submit bulk ── */
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedModule) return;

    // client-side validation
    for (let i = 0; i < builderQs.length; i++) {
      const q = builderQs[i];
      if (!q.question_text.trim()) { showToast(`Question ${i + 1}: Text is required.`, 'warning'); return; }
      const marksVal = parseInt(q.marks);
      if (!isPromptMode(q) && (isNaN(marksVal) || marksVal < 1)) { 
        showToast(`Question ${i + 1}: Marks must be at least 1.`, 'warning'); return; 
      }
      if (isMCQ(q.question_type) && !isPromptMode(q)) {
        if (q.options.some((o) => !o.option_text.trim())) { showToast(`Question ${i + 1}: All option texts are required.`, 'warning'); return; }
        if (!q.options.some((o) => o.is_correct)) { showToast(`Question ${i + 1}: Select a correct option.`, 'warning'); return; }
      }
      if (isSpeaking(q.question_type) && (!q.recording_duration || q.recording_duration < 1)) {
        showToast(`Question ${i + 1}: Recording duration must be at least 1 second.`, 'warning'); return;
      }
    }

    setSubmitting(true);
    try {
      if (editingGroupId) {
        // --- GROUP EDIT SAVING FLOW ---
        
        // 1. Determine deleted questions
        const newQsIds = builderQs.map(q => q.id).filter(Boolean);
        const deletedQs = originalGroupQs.filter(oq => !newQsIds.includes(oq.id));
        for (const dq of deletedQs) {
          await api.delete(`/admin/question/${dq.id}`);
        }
        
        // 2. Perform updates and insertions in-order
        for (let idx = 0; idx < builderQs.length; idx++) {
          const q = builderQs[idx];
          
          let finalDragDropData = null;
          if (isDragDropAny(q.question_type)) {
            const dd = q.drag_drop_data || {};
            const rawItems = dd.items || [];
            const normalizedItems = rawItems.map((item, i) => {
              if (typeof item === 'string') return { text: item, order: i + 1 };
              const parsedOrder = parseInt(item.order);
              return {
                text: item.text || '',
                order: (!isNaN(parsedOrder) && parsedOrder > 0) ? parsedOrder : (i + 1)
              };
            });
            finalDragDropData = { ...dd, items: normalizedItems };
          }
          
          const formData = new FormData();
          formData.append('question_type', q.question_type);
          formData.append('question_text', q.question_text);
          formData.append('audio_script', q.audio_script || '');
          formData.append('marks', (isPromptMode(q) ? 0 : q.marks).toString());
          formData.append('display_type', q.display_type || 'click');
          formData.append('question_set', q.question_set || selectedQuestionSet || 'set1');
          formData.append('order_index', idx.toString());
          if (isSpeaking(q.question_type)) {
            formData.append('recording_duration', (q.recording_duration || 30).toString());
          }
          formData.append('options_json', JSON.stringify((isMCQ(q.question_type) && !isPromptMode(q)) ? q.options : []));
          if (isDragDropAny(q.question_type)) {
            formData.append('drag_drop_data_json', JSON.stringify(finalDragDropData));
          }
          if (q.audio_file) {
            formData.append('media_file', q.audio_file);
          }
          
          if (q.id) {
            // Safe in-place update for existing question in the group
            await api.put(`/admin/question/${q.id}`, formData);
          } else {
            // Append newly added question to this group
            formData.append('module_id', selectedModule.id.toString());
            formData.append('group_id', editingGroupId);
            await api.post('/admin/question', formData);
          }
        }
        
        showToast('Question group updated successfully', 'success');
        setEditingGroupId(null);
        setOriginalGroupQs([]);
        
      } else {
        // --- ORIGINAL BULK CREATION FLOW ---
        const uploadedMediaUrls = {};
        for (const q of builderQs) {
          if (q.audio_file) {
            const fd = new FormData();
            fd.append('media_file', q.audio_file);
            const res = await api.post('/admin/upload-media', fd);
            uploadedMediaUrls[q._id] = res.data.media_url;
          }
        }

        const questionsPayload = builderQs.map((q, idx) => {
          let finalDragDropData = null;
          if (isDragDropAny(q.question_type)) {
            const dd = q.drag_drop_data || {};
            const rawItems = dd.items || [];
            const normalizedItems = rawItems.map((item, i) => {
              if (typeof item === 'string') return { text: item, order: i + 1 };
              const parsedOrder = parseInt(item.order);
              return {
                text: item.text || '',
                order: (!isNaN(parsedOrder) && parsedOrder > 0) ? parsedOrder : (i + 1)
              };
            });
            finalDragDropData = { ...dd, items: normalizedItems };
          }

          return {
            question_type: q.question_type,
            question_text: q.question_text,
            marks: isPromptMode(q) ? 0 : q.marks,
            order_index: idx,
            recording_duration: isSpeaking(q.question_type) ? q.recording_duration : null,
            display_type: q.display_type || 'click',
            question_set: q.question_set || selectedQuestionSet || 'set1',
            audio_script: q.audio_script || null,
            media_url: uploadedMediaUrls[q._id] || null,
            options: (isMCQ(q.question_type) && !isPromptMode(q)) ? q.options.map((o) => ({
              option_text: o.option_text,
              explanation: o.explanation || '',
              is_correct: o.is_correct,
            })) : null,
            drag_drop_data: finalDragDropData,
          };
        });

        await api.post('/admin/questions/bulk', {
          module_id: selectedModule.id,
          questions: questionsPayload,
        });
        
        showToast('Questions created successfully', 'success');
      }

      handleCloseAddModal();
      await handleModuleClick(selectedModule);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) 
        ? detail.map(e => `${e.loc[e.loc.length-1]}: ${e.msg}`).join(' | ') 
        : (typeof detail === 'string' ? detail : 'Failed to save questions');
      showToast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Edit combined question group ── */
  const handleEditGroup = (group) => {
    setEditingGroupId(group.group_id);
    const allQs = [...group.question_forms, ...group.questions];
    setOriginalGroupQs(allQs);

    const builderItems = allQs.map((q, idx) => {
      let initialDD = q.drag_drop_data || { drag_items: [''], drop_zones: [''], correct_mapping: {}, fixed_sentence: '', items: [] };
      if (typeof initialDD === 'string') {
        try { initialDD = JSON.parse(initialDD); } catch (e) { initialDD = { items: [] }; }
      }
      if (initialDD.items && Array.isArray(initialDD.items)) {
        initialDD = {
          ...initialDD,
          items: initialDD.items.map((it, i) => {
            if (typeof it === 'string') return { text: it, order: i + 1 };
            return { ...it, text: it.text || '', order: it.order || (i + 1) };
          })
        };
      } else {
        initialDD = { ...initialDD, items: [] };
      }

      return {
        _id: `q-${Date.now()}-${idx}-${Math.random()}`,
        id: q.id, // Databases ID to update in-place!
        question_type: q.question_type,
        question_text: q.question_text,
        marks: q.marks,
        recording_duration: q.recording_duration || 30,
        display_type: q.display_type || 'click',
        options: q.options && q.options.length > 0
          ? q.options.map(o => ({ option_text: o.option_text, explanation: o.explanation || '', is_correct: o.is_correct }))
          : [
              { option_text: '', explanation: '', is_correct: true },
              { option_text: '', explanation: '', is_correct: false },
              { option_text: '', explanation: '', is_correct: false },
            ],
        audio_script: q.audio_script || '',
        media_url: q.media_url || null,
        question_set: q.question_set || selectedQuestionSet || 'set1',
        drag_drop_data: initialDD,
        audio_file: null
      };
    });

    setBuilderQs(builderItems);
    setShowAdd(true);
  };

  /* ── Delete combined question group ── */
  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete the entire Combined Passage Group (including context and all ${group.questions.length} associated questions)?`)) return;
    try {
      setLoading(true);
      await api.delete(`/admin/questions/group/${group.group_id}`);
      showToast('Question group deleted successfully', 'warning');
      await handleModuleClick(selectedModule);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete question group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAddModal = () => {
    setShowAdd(false);
    setEditingGroupId(null);
    setOriginalGroupQs([]);
    const defaultType = isSpeakingMod(selectedModule) ? 'SPEAKING_PROMPT' : 'MCQ';
    setBuilderQs([makeBlankQuestion(0, defaultType, selectedQuestionSet || 'set1')]);
  };

  /* ── Edit single question ── */
  const handleEditQuestion = (q) => {
    let initialDD = q.drag_drop_data || { drag_items: [''], drop_zones: [''], correct_mapping: {}, fixed_sentence: '', items: [] };

    // Safety: ensure drag_drop_data is an object and items are normalized
    if (typeof initialDD === 'string') {
      try { initialDD = JSON.parse(initialDD); } catch (e) { initialDD = { items: [] }; }
    }

    if (initialDD.items && Array.isArray(initialDD.items)) {
      initialDD = {
        ...initialDD,
        items: initialDD.items.map((it, idx) => {
          if (typeof it === 'string') return { text: it, order: idx + 1 };
          return { ...it, text: it.text || '', order: it.order || (idx + 1) };
        })
      };
    } else {
      initialDD = { ...initialDD, items: [] };
    }

    setEditQ({
      id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      audio_script: q.audio_script || '',
      marks: q.marks,
      recording_duration: q.recording_duration || 30,
      display_type: q.display_type || 'click',
      options: q.options && q.options.length > 0
        ? q.options.map((o) => ({ option_text: o.option_text, explanation: o.explanation || '', is_correct: o.is_correct }))
        : [
          { option_text: '', explanation: '', is_correct: true },
          { option_text: '', explanation: '', is_correct: false },
          { option_text: '', explanation: '', is_correct: false },
        ],

      drag_drop_data: initialDD,
      media_file: null,
      question_set: q.question_set || 'set1',
    });
    setShowEdit(true);
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    const editMarksVal = parseInt(editQ.marks);
    if (!isPromptMode(editQ) && (isNaN(editMarksVal) || editMarksVal < 1)) {
      showToast('Marks must be at least 1.', 'warning');
      return;
    }
    setSubmitting(true);

    let finalDD = editQ.drag_drop_data;
    if (isDragDropAny(editQ.question_type)) {
      const dd = editQ.drag_drop_data || {};
      const rawItems = dd.items || [];
      const normalizedItems = rawItems.map((item, i) => {
        if (typeof item === 'string') return { text: item, order: i + 1 };
        const parsedOrder = parseInt(item.order);
        return {
          text: item.text || '',
          order: (!isNaN(parsedOrder) && parsedOrder > 0) ? parsedOrder : (i + 1)
        };
      });
      finalDD = { ...dd, items: normalizedItems };
    }

    const formData = new FormData();
    formData.append('question_type', editQ.question_type);
    formData.append('question_text', editQ.question_text);
    formData.append('audio_script', editQ.audio_script || '');
    formData.append('marks', isPromptMode(editQ) ? 0 : editQ.marks);
    formData.append('display_type', editQ.display_type || 'click');
    formData.append('question_set', editQ.question_set || 'set1');
    if (isSpeaking(editQ.question_type)) {
      formData.append('recording_duration', editQ.recording_duration || 30);
    }
    formData.append('options_json', JSON.stringify((isMCQ(editQ.question_type) && !isPromptMode(editQ)) ? editQ.options : []));
    if (isDragDropAny(editQ.question_type)) {
      formData.append('drag_drop_data_json', JSON.stringify(finalDD));
    }
    if (editQ.media_file) formData.append('media_file', editQ.media_file);
    try {
      await api.put(`/admin/question/${editQ.id}`, formData);
      showToast('Question updated successfully', 'success');
      setShowEdit(false);
      await handleModuleClick(selectedModule);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMsg = Array.isArray(detail) 
        ? detail.map(e => `${e.loc[e.loc.length-1]}: ${e.msg}`).join(' | ') 
        : (typeof detail === 'string' ? detail : 'Failed to update question');
      showToast(errorMsg, 'error');
    } finally { setSubmitting(false); }
  };

  const handleDeleteQuestion = async (q) => {
    if (!window.confirm(`Delete: "${q.question_text.slice(0, 60)}"?`)) return;
    try {
      await api.delete(`/admin/question/${q.id}`);
      showToast('Question deleted', 'warning');
      await handleModuleClick(selectedModule);
    }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to delete', 'error'); }
  };

  /* ── Module settings helpers ── */
  const handleAddMapping = () => {
    setModuleSettings(prev => ({
      ...prev,
      proficiency_mapping: [
        ...(prev.proficiency_mapping || []),
        { min: '', max: '', level: '', cefr: '', description: '' }
      ]
    }));
  };

  const handleUpdateMapping = (index, field, value) => {
    setModuleSettings(prev => {
      const updated = [...(prev.proficiency_mapping || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, proficiency_mapping: updated };
    });
  };

  const handleDeleteMapping = (index) => {
    setModuleSettings(prev => {
      const updated = (prev.proficiency_mapping || []).filter((_, i) => i !== index);
      return { ...prev, proficiency_mapping: updated };
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const fd = new FormData();
      fd.append('pass_marks', moduleSettings.pass_marks);
      fd.append('duration_minutes', moduleSettings.duration_minutes);
      fd.append('total_marks', moduleSettings.total_marks || 100);
      fd.append('description', moduleSettings.description || '');
      fd.append('module_type', moduleSettings.module_type || 'reading');
      fd.append('proficiency_mapping', JSON.stringify(moduleSettings.proficiency_mapping || []));

      if (selectedModule.name.toLowerCase().includes('speaking')) {
        if (moduleSettings.begin_speaking_audio) {
          fd.append('begin_speaking_audio', moduleSettings.begin_speaking_audio);
        }
        if (moduleSettings.speaking_recording_duration) {
          fd.append('speaking_recording_duration', moduleSettings.speaking_recording_duration);
        }
      }

      await api.post(`/admin/module-settings/${selectedModule.id}`, fd);
      showToast('Module settings saved successfully', 'success');
      fetchModules();
    } catch { showToast('Failed to update module settings', 'error'); }
    finally { setSavingSettings(false); }
  };


  /* ── Excel Upload handlers ── */
  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/admin/questions/excel-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'questions_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedModule) return;
    e.target.value = '';
    setExcelUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/admin/questions/excel-upload/${selectedModule.id}`, fd);
      const { created, errors } = res.data;
      if (created > 0) showToast(`✅ ${created} question(s) imported successfully!`, 'success');
      if (errors && errors.length > 0) {
        showToast(`⚠️ ${errors.length} row(s) had errors. Check console for details.`, 'warning');
        console.warn('Excel upload errors:', errors);
      }
      await handleModuleClick(selectedModule);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || 'Excel upload failed');
      showToast(msg, 'error');
    } finally {
      setExcelUploading(false);
    }
  };

  /* ── Edit Q helpers ── */
  const editSetCorrect = (i) => setEditQ({ ...editQ, options: editQ.options.map((o, idx) => ({ ...o, is_correct: idx === i })) });
  const editUpdateOpt = (i, text) => { const opts = [...editQ.options]; opts[i] = { ...opts[i], option_text: text }; setEditQ({ ...editQ, options: opts }); };
  const editUpdateOptExplanation = (i, text) => { const opts = [...editQ.options]; opts[i] = { ...opts[i], explanation: text }; setEditQ({ ...editQ, options: opts }); };
  const editAddOpt = () => setEditQ({ ...editQ, options: [...editQ.options, { option_text: '', explanation: '', is_correct: false }] });
  const editRemoveOpt = (i) => {
    if (editQ.options.length <= 2) return;
    const isRemovingCorrect = editQ.options[i].is_correct;
    const opts = editQ.options.filter((_, idx) => idx !== i);
    if (isRemovingCorrect && opts.length > 0) opts[0].is_correct = true;
    setEditQ({ ...editQ, options: opts });
  };
  const editCorrectIdx = editQ ? editQ.options.findIndex((o) => o.is_correct) : 0;


  /* ── Abbreviate long module names for sidebar ── */
  const abbreviateName = (name) => {
    if (!name || name.length <= 12) return name || '';
    return name
      .split(/[\s&]+/)
      .filter(Boolean)
      .map(w => w[0].toUpperCase())
      .join(name.includes('&') ? ' & ' : ' ');
  };

  /* ─────────────────────────── JSX ─────────────────────────── */
  return (
    <div className="admin-qm-layout fade-in">

      {/* Sidebar */}
      <aside className="qm-sidebar glass">
        <div className="sidebar-brand">
          <h2>Question Bank</h2>
        </div>
        <div className="module-list">
          {modules.map((m) => {
            const name = m.name.toLowerCase();
            let Icon = BookOpen;
            if (name.includes('speaking')) Icon = Mic;
            if (name.includes('listening')) Icon = Headphones;
            if (name.includes('writing')) Icon = PenTool;
            if (name.includes('reading')) Icon = Eye;

            return (
              <button
                key={m.id}
                className={`module-nav-item ${selectedModule?.id === m.id ? 'active' : ''}`}
                onClick={() => handleModuleClick(m)}
                title={m.name.length > 12 ? m.name : undefined}
              >
                <div className="nav-item-content">
                  <Icon size={16} className="nav-mod-icon" />
                  <span className="mod-name">{abbreviateName(m.name)}</span>
                </div>
                <ChevronRight size={14} className="arrow-icon" />
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main area */}
      <main className="qm-main">
        <header className="main-header">
          <div className="header-info">
            <h1>{selectedModule ? abbreviateName(selectedModule.name) : 'Select Module'}</h1>
            <div className="header-meta">
              <span>{filteredQuestions.filter(q => !isPromptMode(q)).length} questions</span>
              <span className="dot">•</span>
              <span>{selectedModule?.duration_minutes} mins</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={selectedQuestionSet}
                onChange={(e) => setSelectedQuestionSet(e.target.value)}
                style={{ padding: '4px 6px', minWidth: '70px', maxWidth: '80px', borderRadius: '8px', border: '1px solid #c7d2fe', background: '#fff', color: '#0f172a', fontWeight: 700, fontSize: '12px' }}
              >
                {QUESTION_SETS.map((setId) => (
                  <option key={setId} value={setId}>{getSetLabel(setId)}</option>
                ))}
              </select>
            <button
              onClick={handleDownloadTemplate}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              title="Download blank Excel template"
            >
              <Download size={15} /> Template
            </button>
            <button
              onClick={() => excelInputRef.current?.click()}
              disabled={!selectedModule || excelUploading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid #2C347F', background: '#e9ecf8', color: '#2C347F', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              title="Upload questions from Excel file"
            >
              {excelUploading ? <Loader2 size={15} className="animate-spin" /> : <Table2 size={15} />}
              {excelUploading ? 'Uploading…' : 'Upload Excel'}
            </button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleExcelUpload}
            />
            <button onClick={() => {
              const defaultType = isSpeakingMod(selectedModule) ? 'SPEAKING_PROMPT' : 'MCQ';
              setBuilderQs([makeBlankQuestion(0, defaultType, selectedQuestionSet || 'set1')]);
              setShowAdd(true);
            }} className="btn-add-primary pulsate">
              <Plus size={20} /> Create Questions
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loading-state-centered">
            <Loader2 className="animate-spin" size={48} />
            <p>Loading…</p>
          </div>
        ) : (
          <>
            <div className="questions-masonry">
              {filteredQuestions.length === 0 ? (
                <div className="empty-state card glass">
                  <AlertCircle size={48} />
                  <h3>No Questions in {getSetLabel(selectedQuestionSet)}</h3>
                  <p>Switch sets or create questions for this set.</p>
                </div>
              ) : (
                groupQuestions(filteredQuestions).map((item, i) => {
                  if (item.is_grouped) {
                    return (
                      <div key={item.id} className="q-preview-card card glass-hover qb-combined-card" style={{ borderLeft: '6px solid #4f46e5', gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                        <div className="q-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className="badge-marks" style={{ color: '#4f46e5', fontWeight: '800', fontSize: '13px' }}>
                              {item.marks} Total Marks
                            </span>
                          </div>
                          <span className="badge-order" style={{ fontWeight: '800', color: '#94a3b8' }}>#{i + 1}</span>
                        </div>
                        
                        {item.question_forms.length > 0 && (
                          <div className="qb-passage-section" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '11px', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                              <BookOpen size={14} style={{ color: '#4f46e5' }} /> Passage Context (Question Form)
                            </div>
                            {item.question_forms.map((formQ, idx) => (
                              <p key={formQ.id} style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#1e293b', whiteSpace: 'pre-wrap', fontWeight: '500', borderBottom: idx < item.question_forms.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: idx < item.question_forms.length - 1 ? '8px' : '0' }}>
                                {formQ.question_text}
                              </p>
                            ))}
                          </div>
                        )}
                        
                        <div className="qb-questions-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ fontWeight: '800', fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                            Associated Questions ({item.questions.length})
                          </div>
                          {item.questions.map((child, idx) => (
                            <div key={child.id} className="qb-child-q-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '800', fontSize: '13px', color: '#4f46e5' }}>
                                  Question {idx + 1}: {child.question_type.replace(/_/g, ' ')}
                                </span>
                                <span style={{ fontWeight: '700', fontSize: '12px', color: '#64748b' }}>
                                  {child.marks} Marks
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#334155' }}>{child.question_text}</p>
                              
                              {/* Option display for MCQs */}
                              {isMCQ(child.question_type) && child.options && child.options.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '8px', paddingLeft: '8px' }}>
                                  {child.options.map((opt, optIdx) => (
                                    <div key={opt.id || optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: opt.is_correct ? '#10b981' : '#64748b', fontWeight: opt.is_correct ? '700' : '500', padding: '6px 10px', borderRadius: '6px', background: opt.is_correct ? '#f0fdf4' : '#f8fafc', border: opt.is_correct ? '1px solid #dcfce7' : '1px solid #e2e8f0' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '4px', background: opt.is_correct ? '#10b981' : '#e2e8f0', color: opt.is_correct ? '#fff' : '#475569', fontSize: '10px', fontWeight: '800' }}>
                                        {getOptionLabel(optIdx)}
                                      </span>
                                      <span style={{ flex: 1 }}>{opt.option_text}</span>
                                      {opt.is_correct && <Check size={12} style={{ color: '#10b981' }} />}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="q-actions" style={{ display: 'flex', gap: '10px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                          <button type="button" className="q-btn-edit" style={{ flex: 1, background: '#eef2ff', color: '#4f46e5', border: '1.5px solid #c7d2fe', padding: '10px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => handleEditGroup(item)}>
                            <Edit2 size={15} /> Edit Group
                          </button>
                          <button type="button" className="q-btn-delete" style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => handleDeleteGroup(item)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Standalone question rendering
                  return (
                    <div key={item.id} className="q-preview-card card glass-hover">
                      <div className="q-meta">
                        <span className={`badge-type ${item.question_type?.toLowerCase().replace('_', '-') || 'unknown'}`}>
                          {item.question_type?.replace(/_/g, ' ') || 'Unknown'}
                        </span>
                        {!isPromptMode(item) && <span className="badge-marks">{item.marks} Marks</span>}
                        <span className="badge-order">#{i + 1}</span>
                      </div>
                      <h3 className="q-title-preview">{item.question_text}</h3>
                      {isSpeaking(item.question_type) && item.recording_duration && (
                        <div className="q-media-attached"><Clock size={13} /> {item.recording_duration}s recording</div>
                      )}
                      {item.media_url && (
                        <div className="q-media-attached"><Image size={13} /> Media Attached</div>
                      )}
                      <div className="q-actions">
                        <button className="q-btn-edit" onClick={() => handleEditQuestion(item)}><Edit2 size={15} /> Edit</button>
                        <button className="q-btn-delete" onClick={() => handleDeleteQuestion(item)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Module settings */}
            {selectedModule && (
              <footer className="qm-footer-settings card glass fade-in">
                <div className="settings-header">
                  <div className="settings-title">
                    <Clock size={24} className="icon-blue" />
                    <div>
                      <h4>Module Configuration</h4>
                      <p>Timing and evaluation criteria for {selectedModule.name}</p>
                    </div>
                  </div>
                  <button onClick={handleSaveSettings} className="btn-save-settings" disabled={savingSettings}>
                    {savingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Save Configuration
                  </button>
                </div>
                <div className="settings-form">
                  <div className="settings-field">
                    <label>Total Marks</label>
                    <div className="field-input-wrapper">
                      <Award size={18} />
                      <input type="number" value={moduleSettings.total_marks || ''} onChange={(e) => setModuleSettings({ ...moduleSettings, total_marks: parseInt(e.target.value) || 0 })} min="1" />
                    </div>
                  </div>
                  <div className="settings-field">
                    <label>Test Duration (Minutes)</label>
                    <div className="field-input-wrapper">
                      <Clock size={18} />
                      <input type="number" value={moduleSettings.duration_minutes} onChange={(e) => setModuleSettings({ ...moduleSettings, duration_minutes: parseInt(e.target.value) })} min="1" />
                    </div>
                  </div>
                  <div className="settings-field">
                    <label>Module Type</label>
                    <div className="field-input-wrapper no-icon">
                      <select
                        value={moduleSettings.module_type || 'reading'}
                        onChange={(e) => setModuleSettings({ ...moduleSettings, module_type: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: '600' }}
                      >
                        <option value="reading">Reading</option>
                        <option value="listening">Listening</option>
                        <option value="writing">Writing</option>
                        <option value="speaking">Speaking</option>
                      </select>
                    </div>
                  </div>
                  <div className="settings-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Assessment Description</label>
                    <div className="field-input-wrapper no-icon">
                      <textarea
                        value={moduleSettings.description}
                        onChange={(e) => setModuleSettings({ ...moduleSettings, description: e.target.value })}
                        placeholder="Main Assessment Instructions (displayed to candidates)..."
                        rows={4}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: '500', outline: 'none', resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  {selectedModule?.name.toLowerCase().includes('speaking') && (
                    <div className="speaking-extra-settings" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div className="settings-field">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mic size={16} /> Begin Speaking Audio (Global)</label>
                        <div className="field-input-wrapper no-icon">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setModuleSettings({ ...moduleSettings, begin_speaking_audio: e.target.files[0] })}
                            style={{ padding: '8px', fontSize: '14px' }}
                          />
                          {moduleSettings.begin_speaking_audio_url && (
                            <p style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>Existing: {moduleSettings.begin_speaking_audio_url.split('/').pop()}</p>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Dynamic Level & Mark Ranges Mapping */}
                  <div className="settings-field" style={{ gridColumn: '1 / -1', marginTop: '16px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <Award size={18} style={{ color: '#2C347F' }} />
                      <label style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Proficiency Level & Mark Ranges</label>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', fontWeight: '500' }}>
                      Define mark ranges (minimum to maximum scores) and map them to custom proficiency levels (e.g. Level 5, CEFR, description).
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(moduleSettings.proficiency_mapping || []).map((mapping, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 2fr auto', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Level</label>
                            <input 
                              type="text" 
                              required
                              value={mapping.level || ''} 
                              placeholder="e.g. 5"
                              onChange={(e) => handleUpdateMapping(idx, 'level', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b', outline: 'none', background: '#fff' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Min Mark</label>
                            <input 
                              type="number" 
                              required
                              min="0"
                              value={mapping.min !== undefined ? mapping.min : ''} 
                              placeholder="e.g. 40"
                              onChange={(e) => handleUpdateMapping(idx, 'min', e.target.value === '' ? '' : parseInt(e.target.value))}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b', outline: 'none', background: '#fff' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Max Mark</label>
                            <input 
                              type="number" 
                              required
                              min="0"
                              value={mapping.max !== undefined ? mapping.max : ''} 
                              placeholder="e.g. 45"
                              onChange={(e) => handleUpdateMapping(idx, 'max', e.target.value === '' ? '' : parseInt(e.target.value))}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b', outline: 'none', background: '#fff' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>CEFR (Opt)</label>
                            <input 
                              type="text" 
                              value={mapping.cefr || ''} 
                              placeholder="e.g. B2"
                              onChange={(e) => handleUpdateMapping(idx, 'cefr', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b', outline: 'none', background: '#fff' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Description (Opt)</label>
                            <input 
                              type="text" 
                              value={mapping.description || ''} 
                              placeholder="e.g. Intermediate"
                              onChange={(e) => handleUpdateMapping(idx, 'description', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600', color: '#1e293b', outline: 'none', background: '#fff' }}
                            />
                          </div>
                          <div style={{ alignSelf: 'end', paddingBottom: '2px' }}>
                            <button 
                              type="button" 
                              onClick={() => handleDeleteMapping(idx)}
                              style={{ padding: '9px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                              title="Delete Level Range"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <button 
                      type="button" 
                      onClick={handleAddMapping}
                      style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: '#e9ecf8', color: '#2C347F', border: '1.5px dashed #b1b6e1', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <Plus size={16} /> Add Level Range
                    </button>
                  </div>



                </div>
              </footer>
            )}
          </>
        )}
      </main>

      {/* ════════════ BULK QUESTION BUILDER MODAL ════════════ */}
      {showAdd && (
        <div className="premium-modal-overlay fade-in">
          <div className="builder-modal card slide-up">
            <header className="p-modal-header">
              <div className="p-modal-title">
                <div className="p-modal-icon"><Plus size={22} /></div>
                <div>
                  <h3>{editingGroupId ? 'Edit Combined Questions Group' : 'Create Questions'}</h3>
                  <p>{editingGroupId ? 'Modifying combined passage set' : <>Adding to <strong>{selectedModule?.name}</strong> — drag to reorder</>}</p>
                </div>
              </div>
              <button type="button" onClick={handleCloseAddModal} className="p-modal-close"><XCircle size={26} /></button>
            </header>

            <form onSubmit={handleBulkSubmit} className="builder-form">
              {!editingGroupId && (
                <div style={{ background: '#eaf5f5', border: '1.5px solid #b8dede', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <BookOpen size={20} style={{ color: '#007373', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#076433', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Passage-Based Question Link Tip</h5>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', lineHeight: '1.5', color: '#0a7b3c', fontWeight: '500' }}>
                      To link questions together, set the first block's type to <strong>Question Form</strong> and fill in your passage text, then add your associated **MCQs** below. They will automatically be grouped and display as a unified card!
                    </p>
                  </div>
                </div>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={builderQs.map((q) => q._id)} strategy={verticalListSortingStrategy}>
                  <div className="builder-list">
                    {builderQs.map((q, idx) => (
                      <SortableQuestionBlock
                        key={q._id}
                        q={q}
                        idx={idx}
                        total={builderQs.length}
                        onChange={updateQuestion}
                        onRemove={removeQuestion}
                        onAudioChange={handleAudioChange}
                        isSpeakingModule={isSpeakingMod(selectedModule)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button type="button" className="btn-add-question" onClick={addQuestion}>
                <Plus size={18} /> Add Another Question
              </button>

              <footer className="p-modal-footer">
                <button type="button" onClick={handleCloseAddModal} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-save-large" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  Save {builderQs.filter(q => !isPromptMode(q)).length} Question{builderQs.filter(q => !isPromptMode(q)).length !== 1 ? 's' : ''}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ════════════ EDIT MODAL ════════════ */}
      {showEdit && editQ && (
        <div className="premium-modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="premium-modal card" onClick={(e) => e.stopPropagation()}>
            <header className="p-modal-header">
              <div className="p-modal-title">
                <div className="p-modal-icon"><Edit2 size={22} /></div>
                <div><h3>Edit Question</h3><p>Modify this question's details</p></div>
              </div>
              <button className="p-modal-close" onClick={() => setShowEdit(false)}><XCircle size={26} /></button>
            </header>

            <form onSubmit={handleUpdateQuestion} className="p-modal-form">
              <div className="form-split">
                <div className="form-section main-inputs">
                  <div className="p-input-group">
                    <label><Type size={15} /> Question Text (Visible to Candidate)</label>
                    <textarea required rows={3} value={editQ.question_text} onChange={(e) => setEditQ({ ...editQ, question_text: e.target.value })} />
                  </div>
                  {isListening(editQ.question_type) && (
                    <div className="p-input-group">
                      <label><Mic size={15} /> Audio Script (TTS - Hidden from Candidate)</label>
                      <textarea
                        rows={3}
                        placeholder="Text to read aloud. If empty, uses Question Text."
                        value={editQ.audio_script}
                        onChange={(e) => setEditQ({ ...editQ, audio_script: e.target.value })}
                        style={{ borderLeft: '4px solid #008a8a' }}
                      />
                    </div>
                  )}
                  <div className="p-input-grid">
                    <div className="p-input-group">
                      <label><Layers size={15} /> Type</label>
                      <select value={editQ.question_type} onChange={(e) => setEditQ({ ...editQ, question_type: e.target.value })}>
                        {TYPES.filter(t => isSpeakingMod(selectedModule) ? t.value === 'SPEAKING_PROMPT' : t.value !== 'SPEAKING_PROMPT').map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-input-group">
                      <label><Layers size={15} /> Question Set</label>
                      <select value={editQ.question_set || 'set1'} onChange={(e) => setEditQ({ ...editQ, question_set: e.target.value })}>
                        {QUESTION_SETS.map((setId) => (
                          <option key={setId} value={setId}>{getSetLabel(setId)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-input-group">
                      <label><Award size={15} /> Marks</label>
                      <input 
                        type="number" 
                        min={isPromptMode(editQ) ? "0" : "1"} 
                        value={isPromptMode(editQ) ? 0 : editQ.marks} 
                        onChange={(e) => setEditQ({ ...editQ, marks: e.target.value === '' ? '' : parseInt(e.target.value) })} 
                        disabled={isPromptMode(editQ)}
                      />
                    </div>
                  </div>
                  {isSpeaking(editQ.question_type) && (
                    <div className="p-input-group">
                      <label><Mic size={15} /> Recording Duration (sec)</label>
                      <input type="number" min="1" value={editQ.recording_duration} onChange={(e) => setEditQ({ ...editQ, recording_duration: parseInt(e.target.value) || 30 })} />
                    </div>
                  )}
                  {(editQ.question_type === 'MCQ' || editQ.question_type === 'AUDIO_MCQ' || editQ.question_type === 'WRITING_PROMPT' || editQ.question_type === 'SPEAKING_PROMPT') && !isPromptMode(editQ) && (
                    <div className="p-input-group">
                      <label><Upload size={15} /> Media (optional)</label>
                      <div className="p-file-dropzone">
                        <input type="file" accept="audio/*,image/*" onChange={(e) => setEditQ({ ...editQ, media_file: e.target.files[0] })} id="edit-file-upload" />
                        <label htmlFor="edit-file-upload">
                          {editQ.media_file
                            ? <div className="file-ready"><CheckCircle2 size={20} /><span>{editQ.media_file.name}</span></div>
                            : <div className="file-empty"><Upload size={20} /><span>Replace media (blank = keep existing)</span></div>}
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-section options-aside">
                  {isMCQ(editQ.question_type) ? (
                    <div className="p-options-card">
                      <div className="options-header" style={{ marginBottom: 15 }}>
                        <CheckCircle2 size={17} /><h4>Answer Configuration</h4>
                      </div>

                      <div className="options-display-mode" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#64748b' }}>
                        <label>Display Type:</label>
                        <select
                          value={editQ.display_type || 'click'}
                          onChange={(e) => setEditQ({ ...editQ, display_type: e.target.value })}
                          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
                        >
                          <option value="click">Click (Radio Buttons)</option>
                          <option value="select">Select (Dropdown)</option>
                          {editQ.question_type === 'AUDIO_MCQ' && (
                            <option value="prompt">Without (Prompt/Instruction)</option>
                          )}
                        </select>
                      </div>

                      {editQ.display_type === 'writing' ? (
                        <div className="writing-mode-placeholder" style={{ padding: '20px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                          <p style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                            <Edit2 size={16} style={{ marginBottom: 4 }} /><br />
                            Writing Mode Enabled
                          </p>
                        </div>
                      ) : editQ.display_type === 'prompt' ? (
                        <div className="writing-mode-placeholder" style={{ padding: '20px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                          <p style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                            <Headphones size={16} style={{ marginBottom: 4 }} /><br />
                            Prompt Mode Enabled: No options required.
                          </p>
                        </div>
                      ) : (
                        <div className="options-list-edit">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <label style={{ fontWeight: 700, fontSize: 13 }}>Options</label>
                            <span className="opts-select-hint">
                              Correct:&nbsp;
                              <select
                                value={getOptionLabel(editCorrectIdx >= 0 ? editCorrectIdx : 0)}
                                onChange={(e) => editSetCorrect(e.target.selectedIndex)}
                                className="correct-select"
                                style={{ padding: '2px 8px', borderRadius: 4 }}
                              >
                                {editQ.options.map((_, i) => <option key={i} value={getOptionLabel(i)}>{getOptionLabel(i)}</option>)}
                              </select>
                            </span>
                          </div>

                          {editQ.options.map((o, i) => (
                            <div key={i} className="p-option-container" style={{ marginBottom: '12px' }}>
                              <div className={`p-option-row ${o.is_correct ? 'is-correct' : ''}`} style={{ marginBottom: '4px' }}>
                                <span className="opt-label">{getOptionLabel(i)}</span>
                                <input 
                                  type="text" 
                                  value={o.option_text} 
                                  onChange={(e) => editUpdateOpt(i, e.target.value)} 
                                  placeholder={`Option ${getOptionLabel(i)}`} 
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {o.is_correct && <Check size={14} className="opt-check" />}
                                  {editQ.options.length > 2 && (
                                    <button type="button" onClick={() => editRemoveOpt(i)} className="btn-icon-danger" style={{ padding: '4px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {editQ.question_type !== 'AUDIO_MCQ' && (
                                <div className="opt-explanation-row" style={{ marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <AlertCircle size={12} style={{ color: '#64748b' }} />
                                  <input
                                    type="text"
                                    value={o.explanation || ''}
                                    onChange={(e) => editUpdateOptExplanation(i, e.target.value)}
                                    placeholder={`Reason why this is ${o.is_correct ? 'correct' : 'incorrect'}...`}
                                    style={{ flex: 1, fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc' }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <button type="button" className="btn-add-sm" onClick={editAddOpt} style={{ marginTop: 12 }}>
                            <Plus size={14} /> Add Option
                          </button>
                        </div>
                      )}
                    </div>
                  ) : isDragDropAny(editQ.question_type) ? (
                    <div className="p-options-card dd-edit-config">
                      <div className="options-header">
                        <Layers size={17} /><h4>{isDragDropOrdering(editQ.question_type) ? 'Ordering Configuration' : 'Slots Configuration'}</h4>
                      </div>
                      <div className="dd-edit-body" style={{ flexDirection: 'column' }}>
                        <div className="dd-config-col" style={{ width: '100%', marginBottom: 15 }}>
                          <label className="dd-label-sm">Fixed First Sentence (Optional, not draggable)</label>
                          <input
                            type="text"
                            value={editQ.drag_drop_data?.fixed_sentence || ''}
                            onChange={(e) => setEditQ({ ...editQ, drag_drop_data: { ...editQ.drag_drop_data, fixed_sentence: e.target.value } })}
                            placeholder="e.g. This report gives information..."
                          />
                        </div>
                        <div className="dd-config-col" style={{ width: '100%' }}>
                          <label className="dd-label-sm">Sentences Configuration</label>
                          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, marginTop: -5 }}>Enter sentences in any order and select their correct position (1, 2, 3...) using the dropdown.</p>
                          {(editQ.drag_drop_data?.items || []).map((item, idx) => (
                            <div key={idx} className="dd-input-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                              <select
                                value={item.order || (idx + 1)}
                                onChange={(e) => {
                                  const newOrder = parseInt(e.target.value);
                                  const newItems = [...(editQ.drag_drop_data.items || [])];
                                  const oldOrder = item.order || (idx + 1);
                                  // Find the other item currently occupying the target position to swap
                                  const targetIdx = newItems.findIndex((it, i) => (it.order || (i + 1)) === newOrder);
                                  if (targetIdx !== -1 && targetIdx !== idx) {
                                    newItems[targetIdx] = { ...newItems[targetIdx], order: oldOrder };
                                  }
                                  newItems[idx] = { ...newItems[idx], order: newOrder };
                                  setEditQ({ ...editQ, drag_drop_data: { ...editQ.drag_drop_data, items: newItems } });
                                }}
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800', width: '55px', background: '#f8fafc' }}
                              >
                                {Array.from({ length: editQ.drag_drop_data.items.length }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              <input type="text" value={item.text} onChange={(e) => {
                                const newItems = [...(editQ.drag_drop_data.items || [])];
                                newItems[idx] = { ...newItems[idx], text: e.target.value };
                                setEditQ({ ...editQ, drag_drop_data: { ...editQ.drag_drop_data, items: newItems } });
                              }} placeholder="Enter sentence..." style={{ flex: 1 }} />
                              <button type="button" onClick={() => {
                                const newItems = editQ.drag_drop_data.items.filter((_, i) => i !== idx);
                                setEditQ({ ...editQ, drag_drop_data: { ...editQ.drag_drop_data, items: newItems } });
                              }} className="btn-icon-danger"><Trash2 size={14} /></button>
                            </div>
                          ))}
                          <button type="button" className="btn-add-sm" onClick={() => {
                            const nextOrder = (editQ.drag_drop_data.items || []).length + 1;
                            setEditQ({ ...editQ, drag_drop_data: { ...editQ.drag_drop_data, items: [...(editQ.drag_drop_data.items || []), { text: '', order: nextOrder }] } });
                          }}><Plus size={14} /> Add Sentence</button>
                        </div>
                      </div>
                    </div>
                  ) : isPromptMode(editQ) ? (
                    <div className="p-prompt-info">
                      {editQ.question_type === 'AUDIO_MCQ' ? <Headphones size={40} /> : <Type size={40} />}
                      <h4>{editQ.question_type === 'AUDIO_MCQ' ? 'Audio Instruction' : 'Text Only Prompt'}</h4>
                      <p>
                        {editQ.question_type === 'AUDIO_MCQ' 
                          ? "This block will play audio instructions to the candidate."
                          : "Only the Question Text is configured for this type."}
                      </p>
                    </div>
                  ) : (
                    <div className="p-prompt-info">
                      {isSpeaking(editQ.question_type) ? <Mic size={40} /> : <FileText size={40} />}
                      <h4>{isSpeaking(editQ.question_type) ? 'Audio Response' : 'Written Response'}</h4>
                      <p>No answer options required for this type.</p>
                    </div>
                  )}
                </div>
              </div>
              <footer className="p-modal-footer">
                <button type="button" onClick={() => setShowEdit(false)} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-save-large" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save Changes'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ STYLES ══════════ */}
      <style>{`
        .admin-qm-layout { display: grid; grid-template-columns: 210px 1fr; min-height: 100vh; background: #f8fafc; }
        .qm-sidebar { background: white; border-right: 1px solid #e2e8f0; padding: 24px 12px; }
        .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 12px 24px; border-bottom: 2px solid #f1f5f9; margin-bottom: 20px; }
        .brand-logo-sidebar { width: 54px; height: auto; display: block; object-fit: contain; }
        .sidebar-brand h2 { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
        .module-nav-item { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; margin-bottom: 4px; transition: all .2s cubic-bezier(0.4, 0, 0.2, 1); border: none; background: transparent; cursor: pointer; text-align: left; }
        .module-nav-item:hover { background: #f1f5f9; }
        .module-nav-item.active { background: #eaf5f5; color: #007373; }
        .nav-item-content { display: flex; align-items: center; gap: 10px; }
        .nav-mod-icon { color: #64748b; transition: all .15s; }
        .module-nav-item.active .nav-mod-icon { color: #007373; }
        .mod-name { font-weight: 600; font-size: 12px; }
        .mod-count { display: none; }
        .arrow-icon { opacity: 0; transform: translateX(-4px); transition: all .15s; }
        .module-nav-item.active .arrow-icon { opacity: 1; transform: translateX(0); }

        .qm-main { padding: 40px; max-width: 1400px; margin: 0 auto; width: 100%; }
        .main-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }
        .header-info h1 { font-size: 28px; font-weight: 900; color: #0f172a; margin-bottom: 6px; }
        .header-meta { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #64748b; font-weight: 600; }
        .dot { opacity: .3; }
        .btn-add-primary { background: #007373; color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; box-shadow: 0 8px 15px -3px rgba(0, 115, 115,.35); }
        .pulsate { animation: pulse 2s infinite; }
        @keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(0, 115, 115,.35)} 70%{box-shadow:0 0 0 14px rgba(0, 115, 115,0)} 100%{box-shadow:0 0 0 0 rgba(0, 115, 115,0)} }

        .questions-masonry { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 48px; }
        .q-preview-card { padding: 28px; display: flex; flex-direction: column; gap: 16px; border: 1px solid rgba(0,0,0,.03); transition: all .3s; }
        .q-preview-card:hover { transform: translateY(-3px); box-shadow: 0 16px 20px -5px rgba(0,0,0,.08); }
        .q-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .badge-type { padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #f1f5f9; color: #475569; }
        .badge-marks { font-size: 12px; font-weight: 700; color: #007373; }
        .badge-order { font-size: 11px; font-weight: 600; color: #94a3b8; margin-left: auto; }
        .q-title-preview { font-size: 16px; font-weight: 700; color: #1e293b; line-height: 1.5; flex: 1; }
        .q-media-attached { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 600; background: #f8fafc; padding: 5px 10px; border-radius: 6px; align-self: flex-start; }
        .q-actions { display: flex; gap: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
        .q-btn-edit { flex: 1; background: #e2e8f0; color: #475569; border: none; padding: 8px; border-radius: 8px; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; }
        .q-btn-delete { background: #fee2e2; color: #dc2626; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; }

        /* Drag & Drop Styles */
        .qb-drag-drop-config { padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 15px; }
        .dd-config-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .dd-label-sm { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; display: block; }
        .dd-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .dd-input-row input { flex: 1; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
        .dd-input-row button { padding: 6px; color: #dc2626; background: #fee2e2; border: none; border-radius: 6px; cursor: pointer; }
        .btn-add-sm { background: #eaf5f5; color: #007373; border: 1px dashed #007373; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; margin-top: 4px; }
        .dd-mapping-section { margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
        .dd-mapping-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .dd-mapping-row-item { display: flex; flex-direction: column; gap: 4px; background: white; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .dd-item-name { font-size: 12px; font-weight: 700; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dd-mapping-row-item select { padding: 4px 6px; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 12px; outline: none; }
        .dd-edit-config { max-height: 400px; overflow-y: auto; }

        /* Footer settings */
        .qm-footer-settings { padding: 28px; border: 1px solid #e2e8f0; background: white; margin-top: 32px; }
        .settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
        .settings-title { display: flex; align-items: center; gap: 14px; }
        .icon-blue { color: #007373; }
        .settings-title h4 { font-size: 17px; font-weight: 800; color: #1e293b; }
        .settings-title p { font-size: 13px; color: #64748b; }
        .btn-save-settings { display: flex; align-items: center; gap: 8px; background: #007373; color: white; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all .2s; }
        .btn-save-settings:hover { background: #005959; transform: translateY(-1px); }
        .settings-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 28px; align-items: flex-end; }
        .settings-field label { display: block; font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
        .field-input-wrapper { position: relative; }
        .field-input-wrapper svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .field-input-wrapper input { width: 100%; padding: 13px 13px 13px 46px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 15px; font-weight: 700; outline: none; }
        .field-hint { font-size: 12px; color: #94a3b8; margin-top: 6px; }
        .settings-info-card { background: #f8fafc; padding: 18px; border-radius: 14px; display: flex; align-items: center; gap: 14px; color: #64748b; font-size: 13px; font-weight: 500; border: 1px solid #f1f5f9; }

        /* Modals */
        .premium-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
        .premium-modal { width: 100%; max-width: 920px; max-height: 90vh; overflow-y: auto; background: white; border-radius: 28px; box-shadow: 0 40px 80px -20px rgba(0,0,0,.3); }
        .builder-modal { width: 100%; max-width: 820px; max-height: 92vh; overflow-y: auto; background: #f8fafc; border-radius: 28px; box-shadow: 0 40px 80px -20px rgba(0,0,0,.3); }
        .p-modal-header { padding: 28px 36px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: rgba(255,255,255,.95); backdrop-filter: blur(10px); z-index: 10; border-radius: 28px 28px 0 0; }
        .p-modal-title { display: flex; align-items: center; gap: 18px; }
        .p-modal-icon { width: 52px; height: 52px; background: #eaf5f5; color: #007373; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        .p-modal-title h3 { font-size: 22px; font-weight: 800; color: #0f172a; }
        .p-modal-title p { font-size: 13px; color: #64748b; }
        .p-modal-close { background: none; border: none; color: #94a3b8; cursor: pointer; transition: color .2s; }
        .p-modal-close:hover { color: #e11d48; }
        .p-modal-form { padding: 32px 36px; }
        .form-split { display: grid; grid-template-columns: 1fr 320px; gap: 32px; }
        .p-input-group { margin-bottom: 20px; }
        .p-input-group label { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
        .p-input-group textarea, .p-input-group input[type="number"], .p-input-group select, .p-input-group input[type="text"] { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; transition: border-color .2s; }
        .p-input-group textarea:focus, .p-input-group input:focus, .p-input-group select:focus { border-color: #007373; box-shadow: 0 0 0 3px rgba(0, 115, 115,.1); }
        .p-input-grid { display: grid; grid-template-columns: 1fr 130px; gap: 16px; }
        .p-file-dropzone { border: 2px dashed #e2e8f0; border-radius: 14px; padding: 24px; text-align: center; transition: all .2s; background: #f8fafc; cursor: pointer; position: relative; }
        .p-file-dropzone:hover { border-color: #007373; background: #eaf5f5; }
        .p-file-dropzone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
        .file-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #64748b; font-weight: 600; font-size: 13px; }
        .file-ready { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #059669; font-weight: 700; }
        .p-options-card { background: white; border-radius: 20px; padding: 20px; border: 1px solid #e2e8f0; }
        .options-header { display: flex; align-items: center; gap: 8px; color: #1e293b; margin-bottom: 4px; }
        .options-header h4 { font-size: 16px; font-weight: 800; flex: 1; }
        .opts-select-hint { display: flex; align-items: center; font-size: 13px; color: #64748b; font-weight: 600; white-space: nowrap; }
        .correct-select { border: 1px solid #007373; border-radius: 6px; padding: 3px 8px; font-weight: 700; color: #007373; background: #eaf5f5; font-size: 13px; outline: none; margin-left: 4px; cursor: pointer; }
        .options-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
        .p-option-row { display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 10px 14px; border-radius: 12px; border: 1.5px solid #e2e8f0; transition: all .2s; }
        .p-option-row.is-correct { border-color: #10b981; background: #f0fdf4; }
        .opt-label { font-size: 13px; font-weight: 800; color: #64748b; width: 20px; text-align: center; }
        .p-option-row input[type="text"] { flex: 1; border: none; background: transparent; font-weight: 600; color: #1e293b; font-size: 14px; outline: none; }
        .opt-check { color: #10b981; flex-shrink: 0; }
        .p-prompt-info { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px; padding: 28px; color: #64748b; background: #f8fafc; border-radius: 20px; border: 1px solid #e2e8f0; }
        .p-prompt-info h4 { font-size: 17px; font-weight: 800; color: #1e293b; }
        .p-modal-footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 14px; }
        .btn-cancel { background: #f1f5f9; color: #475569; border: none; padding: 12px 22px; border-radius: 12px; font-weight: 700; cursor: pointer; }
        .btn-save-large { background: #007373; color: white; border: none; padding: 12px 28px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; box-shadow: 0 8px 15px -3px rgba(0, 115, 115,.35); display: flex; align-items: center; gap: 8px; }
        .btn-save-large:disabled { opacity: .65; cursor: not-allowed; }

        /* Builder */
        .builder-form { padding: 24px 28px; }
        .builder-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px; }
        .qb-block { padding: 0; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; background: white; }
        .qb-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #eef2f7; flex-wrap: wrap; }
        .qb-drag-handle { cursor: grab; color: #94a3b8; display: flex; align-items: center; padding: 4px; border-radius: 6px; }
        .qb-drag-handle:hover { background: #e2e8f0; color: #475569; }
        .qb-num { font-size: 13px; font-weight: 800; color: #1e293b; white-space: nowrap; }
        .qb-type-pills { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
        .qb-type-pill { padding: 5px 12px; border-radius: 20px; border: 1.5px solid #e2e8f0; background: white; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; transition: all .15s; }
        .qb-type-pill:hover { border-color: #007373; color: #007373; }
        .qb-type-pill.active { background: #007373; color: white; border-color: #007373; }
        .qb-remove { background: #fee2e2; color: #dc2626; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .qb-body { padding: 20px; }
        .qb-row-meta { display: flex; gap: 16px; align-items: flex-end; margin-bottom: 20px; }
        .qb-row-meta .p-input-group { margin-bottom: 0; }
        .qb-options { margin-top: 4px; }
        .btn-add-question { width: 100%; padding: 14px; border: 2px dashed #007373; background: #eaf5f5; color: #007373; border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all .2s; margin-top: 4px; }
        .btn-add-question:hover { background: #d4f3df; }

        .empty-state { grid-column: 1/-1; padding: 60px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; color: #94a3b8; }
        .empty-state h3 { color: #1e293b; font-size: 22px; font-weight: 800; }
        .fade-in { animation: fadeIn .3s ease; }
        @keyframes fadeIn { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .slide-up { animation: slideUp .25s ease; }
        @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};
export default QuestionManagement;
