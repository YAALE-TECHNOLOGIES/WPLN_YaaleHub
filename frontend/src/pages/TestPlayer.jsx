import React, { useState, useEffect, useRef } from 'react';

import { useParams, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { useToast } from '../context/ToastContext';

import {

  Clock, AlertTriangle, Shield, CheckCircle,

  ChevronLeft, ChevronRight, Mic, StopCircle, PlayCircle, Loader2, GripVertical

} from 'lucide-react';

import {

  DndContext,

  useDraggable,

  useDroppable,

  PointerSensor,

  useSensor,

  useSensors,

  closestCenter,

} from '@dnd-kit/core';

import {

  arrayMove,

  SortableContext,

  useSortable,

  verticalListSortingStrategy,

} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

import api, { BASE_URL } from '../api/api';

import Calculator from '../components/Calculator';

import { Calculator as CalcIcon, X as CloseIcon } from 'lucide-react';



const isPromptMode = (q) => q?.question_type === 'QUESTION_FORM' || (q?.question_type === 'AUDIO_MCQ' && q?.display_type === 'prompt');



/* ─── Drag & Drop Ordering Components ─── */

function SortableSentence({ id, text }) {

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {

    transform: CSS.Transform.toString(transform),

    transition,

    opacity: isDragging ? 0.5 : 1,

    zIndex: isDragging ? 100 : 'auto',

    position: 'relative'

  };



  return (

    <div

      ref={setNodeRef}

      {...attributes}

      {...listeners}

      className={`dd-item ${isDragging ? 'dragging' : ''}`}

      style={{

        ...style,

        padding: '12px 16px',

        background: '#fff',

        border: '1px solid #e2e8f0',

        borderRadius: '8px',

        marginBottom: '8px',

        display: 'flex',

        alignItems: 'center',

        gap: '12px',

        cursor: 'grab'

      }}

    >

      <GripVertical size={16} className="text-slate-400" />

      <span style={{ fontSize: '15px', color: '#1e293b', fontWeight: 500 }}>{text}</span>

    </div>

  );

}



function DragDropSlotsQuestion({ question, currentAnswer, onChange }) {

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const data = question.drag_drop_data || { fixed_sentence: '', items: [] };

  const items = (data.items || []).map((t, i) => ({

    id: i,

    text: typeof t === 'string' ? t : t.text

  }));



  // answer state: array of item indices, where index of array is slot index

  const [slotMapping, setSlotMapping] = useState(() => {

    if (currentAnswer && currentAnswer.text_response) {

      try {

        return JSON.parse(currentAnswer.text_response);

      } catch (e) { console.error("Failed to parse slots answer", e); }

    }

    return Array(items.length).fill(null);

  });



  const [availableItems, setAvailableItems] = useState(() => {

    const used = new Set(slotMapping.filter(id => id !== null));

    return items.filter(item => !used.has(item.id));

  });



  const handleDragEnd = (event) => {

    const { active, over } = event;

    if (!over) return;



    const itemId = active.id; // numeric ID

    const overId = over.id; // e.g. "slot-0" or "source"



    if (overId.startsWith('slot-')) {

      const slotIdx = parseInt(overId.replace('slot-', ''));

      const newMapping = [...slotMapping];



      // If item was already in another slot, clear it

      const prevSlotIdx = newMapping.indexOf(itemId);

      if (prevSlotIdx !== -1) newMapping[prevSlotIdx] = null;



      // If slot already had an item, it should return to source (implicitly)

      newMapping[slotIdx] = itemId;



      setSlotMapping(newMapping);

      onChange({ text_response: JSON.stringify(newMapping) });



      // Update available items

      const used = new Set(newMapping.filter(id => id !== null));

      setAvailableItems(items.filter(item => !used.has(item.id)));

    } else if (overId === 'source-container') {

      // Return to source

      const newMapping = [...slotMapping];

      const prevSlotIdx = newMapping.indexOf(itemId);

      if (prevSlotIdx !== -1) {

        newMapping[prevSlotIdx] = null;

        setSlotMapping(newMapping);

        onChange({ text_response: JSON.stringify(newMapping) });

        const used = new Set(newMapping.filter(id => id !== null));

        setAvailableItems(items.filter(item => !used.has(item.id)));

      }

    }

  };



  return (

    <div className="dd-slots-layout" style={{ marginTop: '20px', display: 'flex', gap: '30px' }}>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>

        {/* Left Side: Slots */}

        <div className="dd-slots-left" style={{ flex: 1 }}>

          {data.fixed_sentence && (

            <div style={{ fontSize: '16px', color: '#1e293b', marginBottom: '20px', lineHeight: '1.6' }}>

              {data.fixed_sentence}

            </div>

          )}

          <div className="slots-container" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {slotMapping.map((itemId, idx) => (

              <DroppableSlot key={idx} id={`slot-${idx}`} item={itemId !== null ? items.find(it => it.id === itemId) : null} />

            ))}

          </div>

        </div>



        {/* Right Side: Available Items */}

        <div className="dd-slots-right" style={{ width: '300px', background: '#f1f5f9', borderRadius: '12px', padding: '20px' }}>

          <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>

            Options

          </div>

          <DroppableSourceArea id="source-container">

            {availableItems.map((item) => (

              <DraggableItem key={item.id} id={item.id} text={item.text} />

            ))}

            {availableItems.length === 0 && (

              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>

                All items placed

              </div>

            )}

          </DroppableSourceArea>

        </div>

      </DndContext>

    </div>

  );

}



function DraggableItem({ id, text, inSlot = false }) {

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = transform ? {

    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,

    zIndex: 1000

  } : undefined;



  return (

    <div

      ref={setNodeRef}

      {...listeners}

      {...attributes}

      className={`dd-slot-item ${isDragging ? 'dragging' : ''} ${inSlot ? 'in-slot' : ''}`}

      style={{

        ...style,

        padding: '12px 16px',

        background: '#fff',

        border: '1px solid #e2e8f0',

        borderRadius: '8px',

        marginBottom: '8px',

        cursor: 'grab',

        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',

        display: 'flex',

        alignItems: 'center',

        gap: '10px'

      }}

    >

      <GripVertical size={14} className="text-slate-400" />

      <span style={{ fontSize: '14px', color: '#334155', fontWeight: 500 }}>{text}</span>

    </div>

  );

}



function DroppableSlot({ id, item }) {

  const { isOver, setNodeRef } = useDroppable({ id });

  const style = {

    minHeight: '50px',

    border: isOver ? '2px solid #007373' : '2px dashed #cbd5e1',

    borderRadius: '8px',

    background: isOver ? '#eaf5f5' : '#f8fafc',

    display: 'flex',

    alignItems: 'center',

    padding: '4px',

    transition: 'all 0.2s ease'

  };



  return (

    <div ref={setNodeRef} style={style}>

      {item ? (

        <DraggableItem id={item.id} text={item.text} inSlot={true} />

      ) : (

        <div style={{ flex: 1, height: '40px' }} />

      )}

    </div>

  );

}



function DroppableSourceArea({ id, children }) {

  const { setNodeRef } = useDroppable({ id });

  return (

    <div ref={setNodeRef} style={{ minHeight: '100px' }}>

      {children}

    </div>

  );

}



function DragDropOrderingQuestion({ question, currentAnswer, onChange }) {

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const data = question.drag_drop_data || { fixed_sentence: '', items: [] };



  const [orderedItems, setOrderedItems] = useState(() => {

    if (currentAnswer && currentAnswer.text_response) {

      try {

        const order = JSON.parse(currentAnswer.text_response);

        return order.map(idx => ({

          id: `s-${idx}`,

          index: idx,

          text: typeof data.items[idx] === 'string' ? data.items[idx] : data.items[idx].text

        }));

      } catch (e) { console.error("Failed to parse ordering answer", e); }

    }

    const items = (data.items || []).map((t, i) => ({

      id: `s-${i}`,

      index: i,

      text: typeof t === 'string' ? t : t.text

    }));

    // RELIABLE POSITIONING: The user requested to display items as they were added (randomly/original order)

    // We no longer shuffle them. The admin sets the correct position via dropdown.

    return items;

  });



  useEffect(() => {

    if (!currentAnswer || !currentAnswer.text_response) {

      const order = orderedItems.map(item => item.index);

      onChange({ text_response: JSON.stringify(order) });

    }

  }, []);



  const handleDragEnd = (event) => {

    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {

      const oldIndex = orderedItems.findIndex((i) => i.id === active.id);

      const newIndex = orderedItems.findIndex((i) => i.id === over.id);

      const newOrdered = arrayMove(orderedItems, oldIndex, newIndex);

      setOrderedItems(newOrdered);

      const orderIndexes = newOrdered.map(i => i.index);

      onChange({ text_response: JSON.stringify(orderIndexes) });

    }

  };



  return (

    <div className="dd-ordering-container" style={{ marginTop: '20px' }}>

      {data.fixed_sentence && (

        <div style={{ padding: '12px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', fontSize: '15px', color: '#0f172a', fontWeight: 600 }}>

          {data.fixed_sentence}

        </div>

      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>

        <SortableContext items={orderedItems} strategy={verticalListSortingStrategy}>

          <div className="dd-ordering-list">

            {orderedItems.map((item) => (

              <SortableSentence key={item.id} id={item.id} text={item.text} />

            ))}

          </div>

        </SortableContext>

      </DndContext>

    </div>

  );

}



const TestPlayer = () => {

  const { moduleId, attemptId } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const { showToast } = useToast();

  const [module, setModule] = useState(null);

  const [questions, setQuestions] = useState([]);

  const [questionGroups, setQuestionGroups] = useState([]);

  const [currentIdx, setCurrentIdx] = useState(0);

  const [timeLeft, setTimeLeft] = useState(30 * 60);

  const [answers, setAnswers] = useState({});

  const [status, setStatus] = useState('loading');

  const [warnings, setWarnings] = useState(0);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const audioRef = useRef(new Audio());

  const voicesRef = useRef([]);

  const mountedRef = useRef(true);

  const [sequenceStep, setSequenceStep] = useState('idle');

  const [flowStatus, setFlowStatus] = useState('idle');

  const [recordingCountdown, setRecordingCountdown] = useState(0);

  const [isCalcOpen, setIsCalcOpen] = useState(false);

  const [playingQId, setPlayingQId] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isSecurityLocked, setIsSecurityLocked] = useState(false);



  const timerRef = useRef(null);

  const pendingSavesRef = useRef(0);

  const mediaRecorderRef = useRef(null);

  const audioChunksRef = useRef([]);

  const utteranceRef = useRef(null);

  const recordingTimerRef = useRef(null);

  const recordingIntervalRef = useRef(null);

  const speakingFlowIdRef = useRef(0);

  const saveTimeoutRef = useRef({});



  // Preload voices for TTS

  useEffect(() => {

    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };

    loadVoices();

    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);

  }, []);



  useEffect(() => {

    fetchQuestions();

    if (window.speechSynthesis) window.speechSynthesis.getVoices();





    return () => {

      mountedRef.current = false;

      window.speechSynthesis.cancel();

      audioRef.current.pause();

      clearInterval(timerRef.current);

    };

  }, []);



  useEffect(() => {

    if (status !== 'active') return;



    const handleSecurityViolation = (type) => {

      showToast(`Violation Detected: ${type} is not allowed.`, 'error');

      setWarnings(prev => prev + 1);

    };



    const preventCopyPaste = (e) => { e.preventDefault(); handleSecurityViolation('Copy/Paste'); };

    const preventContextMenu = (e) => { e.preventDefault(); };

    const handleVisibilityChange = () => { if (document.hidden) handleSecurityViolation('Tab switching'); };

    const handleWindowBlur = () => { 

       if (status === 'active') {

         setIsSecurityLocked(true);

         handleSecurityViolation('Window focus lost');

       }

    };

    const handleWindowFocus = () => { };

    const handleKeyDown = (e) => {

      // Prevent PrintScreen, Ctrl+P, Ctrl+U, Ctrl+S

      if (e.key === 'PrintScreen' || (e.ctrlKey && (e.key === 'p' || e.key === 'u' || e.key === 's'))) {

        e.preventDefault();

        handleSecurityViolation('Printing/Screenshot shortcut');

      }

    };



    document.addEventListener('copy', preventCopyPaste);

    document.addEventListener('cut', preventCopyPaste);

    document.addEventListener('paste', preventCopyPaste);

    document.addEventListener('contextmenu', preventContextMenu);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    window.addEventListener('blur', handleWindowBlur);

    window.addEventListener('focus', handleWindowFocus);

    window.addEventListener('keydown', handleKeyDown);



    const handleFsChange = () => {

      const isFs = !!document.fullscreenElement;

      setIsFullscreen(isFs);

      if (status === 'active' && !isFs) {

        setIsSecurityLocked(true);

        handleSecurityViolation('Exited Fullscreen mode');

      }

    };

    document.addEventListener('fullscreenchange', handleFsChange);



    return () => {

      document.removeEventListener('copy', preventCopyPaste);

      document.removeEventListener('cut', preventCopyPaste);

      document.removeEventListener('paste', preventCopyPaste);

      document.removeEventListener('contextmenu', preventContextMenu);

      document.removeEventListener('visibilitychange', handleVisibilityChange);

      window.removeEventListener('blur', handleWindowBlur);

      window.removeEventListener('focus', handleWindowFocus);

      window.removeEventListener('keydown', handleKeyDown);

      document.removeEventListener('fullscreenchange', handleFsChange);

      document.body.classList.remove('security-blur');

    };

  }, [status]);



  useEffect(() => {

    if (status === 'active') startTimer();

  }, [status]);



  const fetchQuestions = async () => {

    try {

      setStatus('loading');

      const res = await api.get(`/candidate/questions/${moduleId}`);

      const rawQuestions = res.data;

      setQuestions(rawQuestions);



      const groups = [];

      const visitedGroups = new Set();

      rawQuestions.forEach((q) => {

        if (!q.group_id) {

          groups.push([q]);

        } else if (!visitedGroups.has(q.group_id)) {

          const groupQs = rawQuestions.filter(rq => rq.group_id === q.group_id);

          groups.push(groupQs);

          visitedGroups.add(q.group_id);

        }

      });

      setQuestionGroups(groups);



      const modRes = await api.get(`/candidate/module/${moduleId}`);

      setModule(modRes.data);

      setTimeLeft(modRes.data.duration_minutes * 60);

      setStatus('instructions');

    } catch (err) {

      console.error(err);

      setStatus('error');

    }

  };



  const startTimer = () => {

    timerRef.current = setInterval(() => {

      setTimeLeft(prev => {

        if (prev <= 1) { clearInterval(timerRef.current); submitAll(); return 0; }

        return prev - 1;

      });

    }, 1000);

  };



  const formatTime = (seconds) => {

    const m = Math.floor(seconds / 60);

    const s = seconds % 60;

    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  };



  // ─── Derived: Is this a Speaking module? ───

  const isSpeakingModule = module?.module_type === 'speaking' || module?.name?.toLowerCase().includes('speaking');

  const isNumeracyModule = module?.module_type === 'numeracy' || module?.name?.toLowerCase().includes('numeracy');

  const isListeningModule = module?.module_type === 'listening' || module?.name?.toLowerCase().includes('listening');



  // ═══════════════════════════════════════════════════════════════════

  // LISTENING-ONLY: handleTTS — used by AUDIO_MCQ "Play Question Audio"

  // DO NOT MODIFY. NOT used by Speaking flow.

  // ═══════════════════════════════════════════════════════════════════

  const handleTTS = (text, qObject, onEndCallback) => {

    let textToRead = text || '';

    if (qObject?.audio_script) {

      textToRead = (textToRead && textToRead !== qObject.audio_script)

        ? `${textToRead}. ${qObject.audio_script}`

        : qObject.audio_script;

    }

    // Remove underscores and [blank] tags so TTS does not pronounce "underscore"

    if (textToRead) {

      textToRead = textToRead

        .replace(/_+/g, ' ')

        .replace(/\[blank\]/gi, ' ')

        .replace(/\s+([,.:;?!])/g, '$1')

        .replace(/([.,])\s*([.,])/g, '$1')

        .replace(/\s+/g, ' ')

        .trim();

    }

    if (!textToRead) { if (onEndCallback) onEndCallback(); return; }



    window.speechSynthesis.cancel();



    setIsSpeaking(true);

    if (qObject?.id) setPlayingQId(qObject.id);



    let isDone = false;

    let autoResetTimer = null;

    let resumeInterval = null;



    const cleanup = () => {

      if (isDone) return;

      isDone = true;

      if (autoResetTimer) clearTimeout(autoResetTimer);

      if (resumeInterval) clearInterval(resumeInterval);

      setIsSpeaking(false);

      setPlayingQId(null);

      if (onEndCallback) onEndCallback();

    };



    const utterance = new SpeechSynthesisUtterance(textToRead);

    utteranceRef.current = utterance;

    utterance.rate = 0.95;

    utterance.volume = 1.0;



    const voices = window.speechSynthesis.getVoices();

    const englishVoice = voices.find(v => v.lang.startsWith('en-')) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (englishVoice) utterance.voice = englishVoice;



    utterance.onend = cleanup;

    utterance.onerror = () => cleanup();



    window.speechSynthesis.speak(utterance);



    // Auto-reset based on estimated speech duration (GUARANTEED to fire)

    // ~10 chars/sec at rate 0.95, with generous buffer

    const estimatedMs = Math.max(5000, Math.ceil(textToRead.length / 5) * 1000 + 4000);

    autoResetTimer = setTimeout(() => {

      if (!isDone) {

        window.speechSynthesis.cancel();

        cleanup();

      }

    }, estimatedMs);



    // Chrome 15s pause workaround — only resume when actually speaking AND paused

    resumeInterval = setInterval(() => {

      if (isDone) { clearInterval(resumeInterval); return; }

      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {

        window.speechSynthesis.resume();

      }

    }, 5000);

  };



  const handleStopAudio = () => {

    window.speechSynthesis.cancel();

    audioRef.current.pause();

    audioRef.current.currentTime = 0;

    setIsSpeaking(false);

    setIsAudioPlaying(false);

    setPlayingQId(null);

    setFlowStatus('idle');

  };



  // ═══════════════════════════════════════════════════════════════════

  // SPEAKING MODULE ONLY — Promise-based helpers

  // ═══════════════════════════════════════════════════════════════════



  /** Play text via Web Speech API. Returns a Promise that resolves when done. */

  const speakingPlayTTS = (text, qObject) => {

    return new Promise((resolve) => {

      let textToRead = text || '';

      if (qObject?.audio_script) {

        textToRead = (textToRead && textToRead !== qObject.audio_script)

          ? `${textToRead}. ${qObject.audio_script}`

          : qObject.audio_script;

      }

      if (textToRead) {

        textToRead = textToRead

          .replace(/_+/g, ' ')

          .replace(/\[blank\]/gi, ' ')

          .replace(/\s+([,.:;?!])/g, '$1')

          .replace(/([.,])\s*([.,])/g, '$1')

          .replace(/\s+/g, ' ')

          .trim();

      }

      if (!textToRead) { resolve(); return; }



      let resolved = false;



      // ✅ FIX: declare in OUTER scope so doResolve can access them

      let resumeInterval = null;

      let safetyTimeout = null;



      const doResolve = () => {

        if (resolved) return;

        resolved = true;

        clearInterval(resumeInterval);  // ✅ now in scope

        clearTimeout(safetyTimeout);    // ✅ now in scope

        if (mountedRef.current) setIsSpeaking(false);

        setTimeout(resolve, 300);

      };



      window.speechSynthesis.cancel();



      setTimeout(() => {

        const utterance = new SpeechSynthesisUtterance(textToRead);

        utteranceRef.current = utterance;

        utterance.rate = 0.9;

        utterance.volume = 1.0;



        const voices = voicesRef.current;

        const englishVoice =

          voices.find(v => v.lang === 'en-US') ||

          voices.find(v => v.lang.startsWith('en-')) ||

          voices[0];

        if (englishVoice) utterance.voice = englishVoice;



        // ✅ assign (not declare) — so doResolve sees the values

        resumeInterval = setInterval(() => {

          if (window.speechSynthesis.paused) window.speechSynthesis.resume();

        }, 2000);



        safetyTimeout = setTimeout(() => {

          console.warn('[TTS] Safety timeout fired');

          doResolve();

        }, 60000);



        utterance.onstart = () => {

          console.log('[TTS] Started speaking');

          if (mountedRef.current) { setIsSpeaking(true); setFlowStatus('tts'); }

        };



        utterance.onend = () => {

          console.log('[TTS] onend fired ✅');

          doResolve();

        };



        utterance.onerror = (e) => {

          console.error('[TTS] onerror:', e.error);

          doResolve();

        };



        window.speechSynthesis.speak(utterance);

      }, 100);

    });

  };



  /** Play the global "Begin Speaking" audio file. Returns a Promise. */

  const speakingPlayBeginAudio = () => {

    return new Promise((resolve) => {

      if (mountedRef.current) setFlowStatus('audio');



      const audioUrl = module?.begin_speaking_audio_url

        ? `${BASE_URL}/${module.begin_speaking_audio_url.replace(/^\//, '')}`

        : null;



      if (!audioUrl) {

        console.log('[Audio] No begin audio, waiting 1s...');

        setTimeout(resolve, 1000);

        return;

      }



      console.log('[Audio] Playing:', audioUrl);

      const speakingAudio = new Audio(audioUrl);

      speakingAudio.onplay = () => { if (mountedRef.current) setIsAudioPlaying(true); };

      speakingAudio.onended = () => {

        console.log('[Audio] Ended ✅');

        if (mountedRef.current) setIsAudioPlaying(false);

        setTimeout(resolve, 300);

      };

      speakingAudio.onerror = () => {

        if (mountedRef.current) setIsAudioPlaying(false);

        resolve();

      };

      speakingAudio.play().catch(() => {

        if (mountedRef.current) setIsAudioPlaying(false);

        resolve();

      });

    });

  };



  /**

   * FIX: speakingStartRecording — wraps startRecording() in a Promise.

   * KEY FIX: We now await getUserMedia BEFORE setting up the timer,

   * so the recording is confirmed active before the countdown begins.

   * Also clears any stale audioUrl for this question before recording.

   */

  // ONLY showing the FIXED speakingStartRecording function + critical fixes

  // Keep your TTS as-is (unchanged as requested)



  const speakingStartRecording = (questionId, durationSeconds) => {

    return new Promise(async (resolve) => {

      console.log("🚀 speakingStartRecording CALLED", { questionId, durationSeconds });



      // ✅ FIX: Validate duration

      if (!durationSeconds || durationSeconds < 3) {

        console.error("❌ Invalid durationSeconds:", durationSeconds);

        durationSeconds = 60;

      }



      setFlowStatus('recording');

      setSequenceStep('recording');

      setRecordingCountdown(durationSeconds);



      let micStream = null;



      try {

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        console.log("🎤 getUserMedia success", micStream);

      } catch (err) {

        console.error("❌ Mic denied:", err);

        resolve();

        return;

      }



      const recorder = new MediaRecorder(micStream);

      console.log("🎙 MediaRecorder created", recorder);



      mediaRecorderRef.current = recorder;

      audioChunksRef.current = [];



      recorder.ondataavailable = (e) => {

        console.log("📦 data chunk received", e.data.size);

        if (e.data && e.data.size > 0) {

          audioChunksRef.current.push(e.data);

        }

      };



      recorder.onstop = () => {

        console.log("⛔ recorder.onstop FIRED");



        clearInterval(recordingIntervalRef.current);



        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        console.log("📦 Blob created", audioBlob.size);



        micStream.getTracks().forEach(track => track.stop());



        if (audioBlob.size > 1000) {

          const audioUrl = URL.createObjectURL(audioBlob);

          handleAnswerChange(questionId, { audioBlob, audioUrl });

          console.log("✅ Recording saved");

        } else {

          console.warn("⚠️ Empty recording");

        }



        setFlowStatus('idle');

        setSequenceStep('complete');



        resolve();

      };



      recorder.onerror = (err) => {

        console.error("❌ Recorder error:", err);

        clearInterval(recordingIntervalRef.current);

        micStream.getTracks().forEach(t => t.stop());

        resolve();

      };



      // ✅ FIX: NO TIMESLICE

      recorder.start();

      console.log("▶ recorder.start CALLED, state:", recorder.state);



      // ✅ FIX: Stable countdown

      const endTime = Date.now() + durationSeconds * 1000;



      recordingIntervalRef.current = setInterval(() => {

        const remaining = Math.ceil((endTime - Date.now()) / 1000);

        console.log("⏳ countdown tick", remaining);



        if (remaining <= 0) {

          setRecordingCountdown(0);

          clearInterval(recordingIntervalRef.current);

        } else {

          setRecordingCountdown(remaining);

        }

      }, 1000);



      // ✅ FIX: Safe auto-stop

      recordingTimerRef.current = setTimeout(() => {

        console.log("⏹ Auto-stop triggered");



        if (recorder.state === 'recording') {

          recorder.stop();

        }

      }, durationSeconds * 1000);

    });

  };



  // ✅ ALSO PATCH THIS (IMPORTANT)

  const cancelSpeakingFlow = () => {

    console.log("🛑 cancelSpeakingFlow CALLED");



    speakingFlowIdRef.current++;

    window.speechSynthesis.cancel();



    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);

    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);



    if (mediaRecorderRef.current?.state === 'recording') {

      try {

        mediaRecorderRef.current.stop();

      } catch (e) { }

    }



    setFlowStatus('idle');

    setIsSpeaking(false);

    setIsAudioPlaying(false);

    setPlayingQId(null);

  };



  // ✅ OPTIONAL: Debug flow

  const runSpeakingSequence = async (questionIndex, flowId) => {

    console.log("🚦 Sequence started", { questionIndex, flowId });



    const q = questions[questionIndex];

    const duration = q?.recording_duration || 60;



    console.log("➡️ Step 1: TTS");

    await speakingPlayTTS(q.question_text, q);



    console.log("➡️ Step 2: Begin Audio");

    await speakingPlayBeginAudio();



    console.log("➡️ Step 3: Recording START");

    await speakingStartRecording(q.id, duration);



    console.log("✅ Sequence COMPLETE");

  };



  /**

   * MAIN SPEAKING ORCHESTRATOR

   * Strict order: TTS → Begin Audio → Recording

   */





  /** Start the speaking flow for the current question */

  const startSpeakingFlow = (overrideIdx) => {

    if (!isSpeakingModule) return;

    cancelSpeakingFlow();

    const flowId = ++speakingFlowIdRef.current;

    const idx = overrideIdx !== undefined ? overrideIdx : currentIdx;

    console.log(`[Speaking] startSpeakingFlow: flowId=${flowId}, questionIndex=${idx}`);

    setSequenceStep('tts');

    setFlowStatus('tts');

    runSpeakingSequence(idx, flowId);

  };



  // Instructions page: read description via TTS, then play begin audio

  const instructionsFlowRanRef = useRef(false);

  useEffect(() => {

    if (status !== 'instructions' || !isSpeakingModule) return;

    if (instructionsFlowRanRef.current) return;

    instructionsFlowRanRef.current = true;



    const flowId = ++speakingFlowIdRef.current;

    (async () => {

      await speakingPlayTTS(module?.description || 'Starting Speaking Test', null);

      if (speakingFlowIdRef.current === flowId) await speakingPlayBeginAudio();

    })();

  }, [status, isSpeakingModule]);



  const handleAnswerChange = (qId, value) => {

    setAnswers(prev => {

      const newAns = { ...prev, [qId]: { ...prev[qId], ...value } };



      const isOptionChange = value.optionId !== undefined;

      const isAudioChange = !!value.audioBlob;

      const isTextChange = value.text !== undefined || value.text_response !== undefined;

      const isMappingChange = value.mapping !== undefined;



      if (isOptionChange || isAudioChange || isMappingChange) {

        saveAnswer(qId, newAns[qId]);

      } else if (isTextChange) {

        if (saveTimeoutRef.current[qId]) clearTimeout(saveTimeoutRef.current[qId]);

        saveTimeoutRef.current[qId] = setTimeout(() => saveAnswer(qId, newAns[qId]), 1000);

      }

      return newAns;

    });

  };



  const saveAnswer = async (qId, value) => {

    pendingSavesRef.current += 1;

    try {

      const formData = new FormData();

      formData.append('attempt_id', attemptId);

      formData.append('question_id', qId);



      if (value.optionId !== undefined && value.optionId !== null)

        formData.append('selected_option_id', value.optionId);



      if (value.text !== undefined && value.text !== null)

        formData.append('text_response', value.text);

      else if (value.mapping !== undefined && value.mapping !== null)

        formData.append('text_response', JSON.stringify(value.mapping));

      else if (value.text_response !== undefined && value.text_response !== null)

        formData.append('text_response', value.text_response);



      if (value.audioBlob)

        formData.append('audio_file', value.audioBlob, `audio_${qId}.webm`);



      await api.post('/candidate/submit-answer', formData);

    } catch (err) {

      console.error('Save failed', err);

    } finally {

      pendingSavesRef.current -= 1;

    }

  };



  const submitAll = async () => {

    setStatus('submitting');

    let retries = 0;

    while (pendingSavesRef.current > 0 && retries < 15) {

      await new Promise(r => setTimeout(r, 200));

      retries++;

    }

    try {

      const res = await api.post(`/candidate/complete-test/${attemptId}`);

      console.log('=== TEST COMPLETE - SCORE RESULT ===', res.data);

      // Directly navigate to result page instead of showing finished status

      navigate(`/results/${attemptId}`);

    } catch (err) {

      console.error(err);

      setStatus('active');

    }

  };



  // ── Status screens ──

  if (status === 'loading') return (

    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <Loader2 className="animate-spin" size={48} />

    </div>

  );



  if (status === 'submitting') return (

    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>

      <Loader2 className="animate-spin" size={64} color="#007373" />

      <h2 style={{ marginTop: '24px', fontWeight: '800', color: '#0f172a' }}>Submitting Your Test...</h2>

      <p style={{ marginTop: '8px', color: '#64748b', fontSize: '15px' }}>Please wait while we finalize your results. Do not refresh the page.</p>

    </div>

  );



  if (status === 'error') return (

    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>

      <div className="card glass" style={{ padding: '60px' }}>

        <AlertTriangle size={64} color="#ef4444" style={{ marginBottom: '20px' }} />

        <h2>Unable to load test</h2>

        <p>Please ensure you have an active test attempt and try again.</p>

        <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px' }}>Back to Dashboard</button>

      </div>

    </div>

  );



  if (status === 'finished') return (

    <div className="finish-ui fade-in">

      <div className="card glass">

        <CheckCircle size={64} color="#10b981" />

        <h2>Test Completed!</h2>

        <p>Your responses have been saved and submitted for evaluation.</p>

        <br />

        <button onClick={() => navigate('/')} className="btn-primary">Return to Dashboard</button>

      </div>

    </div>

  );



  if (status === 'instructions' && questions.length === 0) return (

    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>

      <div className="card glass" style={{ padding: '60px', maxWidth: '520px' }}>

        <AlertTriangle size={64} color="#f59e0b" style={{ marginBottom: '20px' }} />

        <h2>No questions found for this module in your allocated set</h2>

        <p style={{ marginTop: '16px', color: '#475569' }}>

          This module does not have any questions available in the set assigned to you. Please return to the dashboard or contact the administrator.

        </p>

        <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px' }}>Back to Dashboard</button>

      </div>

    </div>

  );



  if (status === 'instructions') return (

    <div className="instructions-wrapper fade-in">

      <div className="instructions-container">

        <div className="inst-header">

          <h1 className="inst-title">Skill Bridge Assessment</h1>

          <h2 className="inst-subtitle">{module?.name}</h2>

        </div>

        <div className="inst-meta-grid">

          <div className="inst-meta-item">

            <span className="inst-meta-label">Number of Questions</span>

            <span className="inst-meta-value">{module?.question_count || questions.filter(q => !isPromptMode(q)).length}</span>

          </div>

          <div className="inst-meta-item">

            <span className="inst-meta-label">Time Allowed</span>

            <span className="inst-meta-value">{module?.duration_minutes} min</span>

          </div>

        </div>

        <div className="inst-description">

          <h3>Assessment Description</h3>

          <div className="description-content">

            {module?.description ? (

              <p>{module.description}</p>

            ) : (

              <p>This assessment evaluates your proficiency in <strong>{module?.name}</strong>. Please read each question carefully and provide your best response.</p>

            )}

          </div>

        </div>

        <div className="inst-actions" style={{ flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '400px', margin: '0 auto' }}>

          {!isFullscreen ? (

            <button

              className="btn-primary"

              onClick={async () => {

                const el = document.documentElement;

                try {

                  if (el.requestFullscreen) await el.requestFullscreen();

                  else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();

                  

                  // After fullscreen granted, wait a tiny bit for the browser to settle then start

                  setTimeout(() => {

                    if (questions.length === 0) return;

                    window.speechSynthesis.cancel();

                    const silentUtterance = new SpeechSynthesisUtterance('');

                    window.speechSynthesis.speak(silentUtterance);

                    audioRef.current.play().then(() => audioRef.current.pause()).catch(() => { });



                    setStatus('active');

                    setWarnings(0);

                    if (isSpeakingModule) setTimeout(() => startSpeakingFlow(0), 300);

                  }, 100);

                } catch (err) {

                  showToast('Fullscreen mode is required to start the assessment.', 'error');

                }

              }}

              style={{ 

                background: '#007373', 

                width: '100%', 

                display: 'flex', 

                alignItems: 'center', 

                justifyContent: 'center', 

                gap: '12px', 

                padding: '14px 28px',

                fontSize: '15px',

                fontWeight: '700'

              }}

            >

              <Shield size={20} strokeWidth={2.5} /> Enter Security Mode & Start Assessment

            </button>

          ) : (

            <button

              className="btn-primary"

              onClick={() => {

                if (questions.length === 0) return;

                window.speechSynthesis.cancel();

                const silentUtterance = new SpeechSynthesisUtterance('');

                window.speechSynthesis.speak(silentUtterance);

                audioRef.current.play().then(() => audioRef.current.pause()).catch(() => { });



                setStatus('active');

                setWarnings(0);

                if (isSpeakingModule) setTimeout(() => startSpeakingFlow(0), 300);

              }}

              style={{ 

                background: '#007373', 

                width: '100%', 

                display: 'flex', 

                alignItems: 'center', 

                justifyContent: 'center', 

                gap: '12px',

                padding: '14px 28px',

                fontSize: '15px',

                fontWeight: '700'

              }}

            >

              Start Assessment Now <ChevronRight size={20} />

            </button>

          )}

          <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '5px', fontWeight: '500' }}>

            Note: Exiting fullscreen or switching windows will trigger a security lock.

          </p>

        </div>

      </div>



      <style>{`

        .instructions-wrapper { min-height:100vh; background:white; display:flex; flex-direction:column; align-items:center; padding:20px 10px; color:#1e293b; }

        .instructions-container { max-width:600px; width:100%; }

        .inst-header { margin-bottom:24px; }

        .inst-title { font-size:14px; font-weight:500; color:#334155; margin-bottom:4px; }

        .inst-subtitle { font-size:18px; font-weight:600; color:#0f172a; }

        .inst-meta-grid { display:flex; gap:40px; margin-bottom:24px; }

        .inst-meta-item { display:flex; flex-direction:column; gap:4px; }

        .inst-meta-label { font-size:12px; color:#475569; }

        .inst-meta-value { font-size:16px; font-weight:800; color:#0f172a; }

        .inst-description { margin-bottom:30px; }

        .inst-description h3 { font-size:14px; font-weight:700; color:#0f172a; margin-bottom:10px; }

        .description-content { font-size:14px; line-height:1.5; color:#334155; }

      `}</style>

    </div>

  );



  if (questions.length === 0 && status === 'active') return (

    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>

      <div className="card glass" style={{ padding: '60px' }}>

        <AlertTriangle size={64} color="#f59e0b" style={{ marginBottom: '20px' }} />

        <h2>No questions found</h2>

        <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px' }}>Back to Dashboard</button>

      </div>

    </div>

  );



  const currentGroup = questionGroups[currentIdx] || [];

  const isLast = currentIdx === questionGroups.length - 1;



  return (

    <div className="test-wrapper">

      <header className="test-header glass">

        <div className="test-info">

          <Shield size={20} color="#007373" />

          <span>{module?.name || 'Skill Bridge Assessment'}</span>

        </div>

        <div className={`timer-box ${timeLeft < 120 ? 'warning' : ''}`}>

          <Clock size={20} />

          <span>{formatTime(timeLeft)}</span>

        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          {(() => {

            if (!isNumeracyModule) return null;



            // Calculate absolute question number for the first question in current group

            let qCount = 0;

            for (let i = 0; i < currentIdx; i++) {

              qCount += (questionGroups[i] || []).filter(q => !isPromptMode(q)).length;

            }

            const firstQNum = qCount + 1;



            if (firstQNum <= 26) return null;



            return (

              <button

                onClick={() => setIsCalcOpen(!isCalcOpen)}

                className={`btn-calc-toggle ${isCalcOpen ? 'active' : ''}`}

                title="Calculator"

              >

                {isCalcOpen ? <CloseIcon size={18} /> : <CalcIcon size={18} />}

                <span>Calculator</span>

              </button>

            );

          })()}

          <button onClick={submitAll} className="btn-primary submit-final">Final Submit</button>

        </div>

      </header>



      <main className="test-container">

        <aside className="question-nav">

          <h3>Questions</h3>

          <div className="q-dots">

            {questionGroups.map((_, i) => (

              <button

                key={i}

                className={`q-dot ${currentIdx === i ? 'active' : ''} ${questionGroups[i].every(q => answers[q.id]?.audioBlob || answers[q.id]?.optionId || answers[q.id]?.text) ? 'answered' : ''}`}

                disabled={(isNumeracyModule && i !== currentIdx) || (isSpeakingModule && i !== currentIdx)}

                onClick={() => {

                  cancelSpeakingFlow();

                  setCurrentIdx(i);

                  if (isSpeakingModule) setTimeout(() => startSpeakingFlow(i), 200);

                }}

              >

                {(() => {

                   const isInstr = !questionGroups[i].some(q => !isPromptMode(q));

                   if (isInstr) return 'i';

                   // Count real questions before this index

                   let realIndex = 0;

                   for(let j=0; j<=i; j++) {

                     if (questionGroups[j].some(q => !isPromptMode(q))) realIndex++;

                   }

                   return realIndex;

                })()}

              </button>

            ))}

          </div>

          <div className="test-guidelines">

            <AlertTriangle size={16} />

            <p>Read all instructions carefully before answering.</p>

          </div>

        </aside>



        <section className="question-area card">

          <div className="q-header">

            <span className="q-num">

              {(() => {

                 const isInstr = !currentGroup.some(q => !isPromptMode(q));

                 if (isInstr) return 'Instructions';

                 

                 let realIndex = 0;

                 for(let j=0; j<=currentIdx; j++) {

                    if (questionGroups[j].some(q => !isPromptMode(q))) realIndex++;

                 }

                 const totalReal = questionGroups.filter(g => g.some(q => !isPromptMode(q))).length;

                 return `Question ${realIndex} of ${totalReal}`;

              })()}

            </span>

          </div>



          <div className="q-body">

            {currentGroup.map((currentQ, gIdx) => (

              <div key={currentQ.id} className="grouped-question" style={{

                borderBottom: (gIdx < currentGroup.length - 1 && !isPromptMode(currentQ)) ? '1px solid #e2e8f0' : 'none',

                paddingBottom: isPromptMode(currentQ) ? '10px' : '20px',

                marginBottom: isPromptMode(currentQ) ? '10px' : '20px',

                display: currentQ?.question_type === 'SPEAKING_PROMPT' ? 'flex' : 'block',

                justifyContent: 'space-between',

                alignItems: 'flex-start',

                gap: '30px'

              }}>

                <div style={{ flex: 1, minWidth: 0 }}>

                  {!isPromptMode(currentQ) && (

                    <div className="q-sub-header" style={{ marginBottom: '15px' }}>

                      <span style={{ fontWeight: '700', fontSize: '13px', color: '#64748b' }}>

                        #{currentGroup.slice(0, gIdx).filter(q => !isPromptMode(q)).length + 1}

                      </span>

                    </div>

                  )}



                  {(() => {

                    const hasMedia = !!currentQ?.media_url;

                    const isImageUrl = hasMedia && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(currentQ.media_url);

                    const isAudioUrl = hasMedia && !isImageUrl;



                    return (

                      <>

                        {/* Audio MCQ logic */}

                        {currentQ?.question_type === 'AUDIO_MCQ' && (

                          <div className="q-media">

                            <p className="sub-text">Audio Section:</p>

                            {(() => {

                              const isThisPlaying = (isSpeaking || isAudioPlaying) && playingQId === currentQ.id;

                              const otherPlaying = (isSpeaking || isAudioPlaying) && playingQId !== currentQ.id;



                              if (!isThisPlaying) {

                                return (

                                  <div className="tts-controls" style={{ margin: '15px 0' }}>

                                    <button

                                      onClick={() => {

                                        if (isAudioUrl) {

                                          // Play physical audio file

                                          audioRef.current.src = `${BASE_URL}/${currentQ.media_url}`;

                                          audioRef.current.play();

                                          setPlayingQId(currentQ.id);

                                          setIsAudioPlaying(true);

                                          audioRef.current.onended = () => {

                                            setIsAudioPlaying(false);

                                            setPlayingQId(null);

                                          };

                                        } else {

                                          // Use TTS (either no media, or media is an image)

                                          handleTTS(currentQ.question_text, currentQ);

                                        }

                                      }}

                                      disabled={otherPlaying}

                                      style={{

                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '10px',

                                        fontWeight: '600', cursor: otherPlaying ? 'not-allowed' : 'pointer', border: 'none', fontSize: '14px',

                                        background: otherPlaying ? '#cbd5e1' : '#008a8a', color: 'white', transition: 'all 0.3s'

                                      }}

                                    >

                                      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid white' }} />

                                      {otherPlaying ? 'Other Audio Playing...' : 'Play Question Audio'}

                                    </button>

                                  </div>

                                );

                              } else {

                                return (

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', margin: '15px 0' }}>

                                    <button

                                      onClick={handleStopAudio}

                                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', border: 'none', fontSize: '14px', background: '#ef4444', color: 'white', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }}

                                    >

                                      <div className="stop-icon" />

                                      Stop Playback

                                    </button>

                                    <div className="now-playing-badge active">

                                      <div className="audio-visualizer">

                                        <span></span><span></span><span></span><span></span>

                                      </div>

                                      <span>Now Playing...</span>

                                    </div>

                                  </div>

                                );

                              }

                            })()}

                          </div>

                        )}



                        {/* Image display logic (shared) */}

                        {isImageUrl && (

                          <div className="q-media">

                            <img src={`${BASE_URL}/${currentQ.media_url.replace(/^\//, '')}`} alt="Question Resource" className="q-image" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 10 }} />

                          </div>

                        )}

                      </>

                    );

                  })()}



                  {currentQ.display_type !== 'select' && (

                    <p className="q-text" style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{currentQ?.question_text}</p>

                  )}



                  {currentQ?.question_type !== 'SPEAKING_PROMPT' && currentQ?.display_type !== 'prompt' && (

                    <div className="q-options">

                      {(currentQ?.question_type === 'MCQ' || currentQ?.question_type === 'AUDIO_MCQ') ? (

                        currentQ?.display_type === 'select' ? (

                          <>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', lineHeight: '1.6' }}>

                              {currentQ.question_text.includes('[blank]') ? (

                                <>

                                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{currentQ.question_text.split('[blank]')[0]}</span>

                                  <select

                                    className="opt-select-inline"

                                    value={answers[currentQ.id]?.optionId || ''}

                                    onChange={(e) => handleAnswerChange(currentQ.id, { optionId: parseInt(e.target.value) })}

                                    disabled={!!answers[currentQ.id]?.optionId}

                                    style={{

                                      padding: '4px 12px',

                                      borderRadius: '8px',

                                      border: '1.5px solid #cbd5e1',

                                      fontSize: '15px',

                                      fontWeight: '600',

                                      minWidth: '180px',

                                      cursor: answers[currentQ.id]?.optionId ? 'not-allowed' : 'pointer',

                                      background: answers[currentQ.id]?.optionId ? '#f1f5f9' : '#fff',

                                      outline: 'none',

                                      color: '#1e293b',

                                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'

                                    }}

                                  >

                                    <option value="" disabled>Select...</option>

                                    {(currentQ?.options || []).map(opt => (

                                      <option key={opt.id} value={opt.id}>{opt.option_text}</option>

                                    ))}

                                  </select>

                                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{currentQ.question_text.split('[blank]')[1]}</span>

                                </>

                              ) : (

                                <>

                                  <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>{currentQ?.question_text}</span>

                                  <select

                                    className="opt-select-inline"

                                    value={answers[currentQ.id]?.optionId || ''}

                                    onChange={(e) => handleAnswerChange(currentQ.id, { optionId: parseInt(e.target.value) })}

                                    disabled={!!answers[currentQ.id]?.optionId}

                                    style={{

                                      padding: '8px 16px',

                                      borderRadius: '10px',

                                      border: '1.5px solid #cbd5e1',

                                      fontSize: '15px',

                                      fontWeight: '600',

                                      minWidth: '220px',

                                      cursor: answers[currentQ.id]?.optionId ? 'not-allowed' : 'pointer',

                                      background: answers[currentQ.id]?.optionId ? '#f1f5f9' : '#fff',

                                      outline: 'none',

                                      color: '#1e293b',

                                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'

                                    }}

                                  >

                                    <option value="" disabled>Select an answer...</option>

                                    {(currentQ?.options || []).map(opt => (

                                      <option key={opt.id} value={opt.id}>{opt.option_text}</option>

                                    ))}

                                  </select>

                                </>

                              )}

                            </div>

                            {(() => {

                              const selOptId = answers[currentQ.id]?.optionId;

                              if (!selOptId) return null;

                              // Hide feedback during test for Listening module or if specifically an Audio MCQ

                              if (isListeningModule || currentQ.question_type === 'AUDIO_MCQ') return null;



                              const selOpt = currentQ.options.find(o => o.id === selOptId);

                              const correctOpt = currentQ.options.find(o => o.is_correct);



                              const showCorrect = true; // Always show correct if answered

                              const showSelected = selOpt && !selOpt.is_correct; // Show selected only if it was wrong



                              return (

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                  {showCorrect && correctOpt && (

                                    <div className="opt-feedback fade-in right" style={{

                                      marginTop: '8px',

                                      padding: '12px 16px',

                                      borderRadius: '12px',

                                      border: '1px solid #10b981',

                                      background: '#f0fdf4',

                                      color: '#065f46',

                                      fontSize: '14px',

                                      fontWeight: '500',

                                      display: 'flex',

                                      flexDirection: 'column',

                                      gap: '4px',

                                      maxWidth: 'fit-content'

                                    }}>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>

                                        <CheckCircle size={16} color="#10b981" /> Right answer: {correctOpt.option_text}

                                      </div>

                                      {correctOpt.explanation && (

                                        <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.5' }}>{correctOpt.explanation}</p>

                                      )}

                                    </div>

                                  )}



                                  {showSelected && (

                                    <div className="opt-feedback fade-in wrong" style={{

                                      marginTop: '8px',

                                      padding: '12px 16px',

                                      borderRadius: '12px',

                                      border: '1px solid #ef4444',

                                      background: '#fef2f2',

                                      color: '#991b1b',

                                      fontSize: '14px',

                                      fontWeight: '500',

                                      display: 'flex',

                                      flexDirection: 'column',

                                      gap: '4px',

                                      maxWidth: 'fit-content'

                                    }}>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>

                                        <StopCircle size={16} color="#ef4444" style={{ transform: 'rotate(45deg)' }} /> Not quite: {selOpt.option_text}

                                      </div>

                                      {selOpt.explanation && (

                                        <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.5' }}>{selOpt.explanation}</p>

                                      )}

                                    </div>

                                  )}

                                </div>

                              );

                            })()}

                          </>

                        ) : (

                          (currentQ?.options || []).map(opt => {

                            const hasAnswered = !!answers[currentQ.id]?.optionId;

                            const selOptId = answers[currentQ.id]?.optionId;

                            const isSelected = selOptId === opt.id;

                            const isCorrect = opt.is_correct;



                            // Show feedback for correct option if answered, OR for selected option if it was wrong

                            const showFeedback = hasAnswered && (isCorrect || isSelected);



                            return (

                              <div key={opt.id} className="opt-container" style={{ marginBottom: '12px' }}>

                                <label

                                  className={`opt-label ${hasAnswered ? (isCorrect ? 'is-right' : (isSelected ? 'is-wrong' : '')) : ''} ${hasAnswered ? 'is-locked' : ''}`}

                                  style={{ cursor: hasAnswered ? 'not-allowed' : 'pointer', opacity: hasAnswered && !isSelected && !isCorrect ? 0.6 : 1 }}

                                >

                                  <input

                                    type="radio"

                                    name={`q-${currentQ.id}`}

                                    checked={isSelected}

                                    onChange={() => !hasAnswered && handleAnswerChange(currentQ.id, { optionId: opt.id })}

                                    disabled={hasAnswered}

                                  />

                                  <span>{opt.option_text}</span>

                                </label>



                                {showFeedback && !isListeningModule && currentQ.question_type !== 'AUDIO_MCQ' && (

                                  <div className={`opt-feedback fade-in ${isCorrect ? 'right' : 'wrong'}`} style={{

                                    marginTop: '8px',

                                    marginLeft: '40px',

                                    padding: '12px 16px',

                                    borderRadius: '12px',

                                    border: `1px solid ${isCorrect ? '#10b981' : '#ef4444'}`,

                                    background: isCorrect ? '#f0fdf4' : '#fef2f2',

                                    color: isCorrect ? '#065f46' : '#991b1b',

                                    fontSize: '14px',

                                    fontWeight: '500',

                                    display: 'flex',

                                    flexDirection: 'column',

                                    gap: '4px'

                                  }}>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>

                                      {isCorrect ? (

                                        <><CheckCircle size={16} color="#10b981" /> Right answer</>

                                      ) : (

                                        <><StopCircle size={16} color="#ef4444" style={{ transform: 'rotate(45deg)' }} /> Not quite</>

                                      )}

                                    </div>

                                    {opt.explanation && (

                                      <p style={{ margin: 0, opacity: 0.9, lineHeight: '1.5' }}>{opt.explanation}</p>

                                    )}

                                  </div>

                                )}

                              </div>

                            );

                          })

                        )

                      ) : currentQ?.question_type === 'WRITING_PROMPT' ? (

                        <div className="writing-container">

                          <textarea

                            placeholder="Type your answer here..."

                            className="writing-input"

                            value={answers[currentQ.id]?.text || ''}

                            onChange={(e) => handleAnswerChange(currentQ.id, { text: e.target.value })}

                          />

                          <div className="char-counter">

                            <span>Characters: {(answers[currentQ.id]?.text || '').length}</span>

                          </div>

                        </div>

                      ) : currentQ?.question_type === 'QUESTION_FORM' ? null : currentQ?.question_type === 'DRAG_DROP_ORDERING' ? (

                        <DragDropOrderingQuestion

                          question={currentQ}

                          currentAnswer={answers[currentQ.id]}

                          onChange={(val) => handleAnswerChange(currentQ.id, val)}

                        />

                      ) : currentQ?.question_type === 'DRAG_DROP_SLOTS' ? (

                        <DragDropSlotsQuestion

                          question={currentQ}

                          currentAnswer={answers[currentQ.id]}

                          onChange={(val) => handleAnswerChange(currentQ.id, val)}

                        />

                      ) : null}

                    </div>

                  )}

                </div> {/* end of left column */}



                {currentQ?.question_type === 'SPEAKING_PROMPT' && (

                  <div style={{ flexShrink: 0, width: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                    <div className="speaking-ui" style={{

                      padding: '25px 20px',

                      width: '100%',

                      border: '2px solid #e2e8f0',

                      borderRadius: '16px',

                      background: '#fff',

                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'

                    }}>

                      <div className="flow-indicator">

                        {flowStatus === 'tts' && <div className="status-pill tts">🔊 Reading Question...</div>}

                        {flowStatus === 'audio' && <div className="status-pill audio">🎵 Get Ready...</div>}

                        {flowStatus === 'recording' && (

                          <div className="status-pill recording">

                            <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 5px rgba(239, 68, 68, 0.5)', display: 'inline-block' }}></div>

                            Recording Live...

                          </div>

                        )}

                        {flowStatus === 'idle' && sequenceStep === 'complete' && <div className="status-pill idle">✅ Response Saved</div>}

                        {flowStatus === 'idle' && sequenceStep !== 'complete' && <div className="status-pill idle">⌛ Preparing...</div>}

                      </div>



                      <div className="recorder-controls">

                        <div

                          className={`rec-btn ${flowStatus === 'recording' ? 'active' : ''}`}

                          style={{ cursor: 'not-allowed', width: '220px', height: '140px', borderRadius: '100px', margin: '0 auto', opacity: flowStatus === 'recording' ? 1 : 0.6 }}

                        >

                          {flowStatus === 'recording'

                            ? <Mic size={36} className="pulse" color="#ef4444" />

                            : <Mic size={36} />

                          }

                          <span style={{ display: 'block', marginTop: '10px', fontSize: '16px', fontWeight: '800' }}>

                            {flowStatus === 'recording' ? 'Recording Live...' : 'Wait for Prompt'}

                          </span>

                        </div>



                        {flowStatus === 'recording' && (

                          <div style={{ textAlign: 'center', width: '100%' }}>

                            <div className="countdown-display" style={{ marginTop: '20px', fontSize: '22px', fontWeight: '800', color: '#ef4444', padding: '10px 24px', borderRadius: '50px', display: 'inline-block' }}>

                              Time Remaining: {recordingCountdown}s

                            </div>

                          </div>

                        )}



                        {flowStatus === 'recording' && ((currentQ?.recording_duration || 60) - recordingCountdown >= 10) && (

                          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '20px' }}>

                            <button

                              className="btn-primary"

                              onClick={() => {

                                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {

                                  mediaRecorderRef.current.stop();

                                }

                              }}

                            >

                              Finish Recording

                            </button>

                          </div>

                        )}

                      </div>



                      {/* FIX: Only show audio player if audioBlob exists (real recording from THIS session) */}

                      {answers[currentQ.id]?.audioBlob && answers[currentQ.id]?.audioUrl && (

                        <div className="playback-preview fade-in" style={{ width: '100%' }}>

                          <p className="sub-text">Captured Recording:</p>

                          <audio controls controlsList="nodownload noplaybackrate nopictureinpicture" src={answers[currentQ.id].audioUrl} style={{ width: '100%', marginTop: '10px' }} />

                        </div>

                      )}

                    </div>

                  </div>

                )}

              </div>

            ))}

          </div>



          <div className="q-footer">

            <button

              className="btn-secondary"

              disabled={currentIdx === 0 || isNumeracyModule || isSpeakingModule || (isSpeakingModule && sequenceStep !== 'complete' && sequenceStep !== 'idle')}

              onClick={() => {

                const newIdx = currentIdx - 1;

                cancelSpeakingFlow();

                setCurrentIdx(newIdx);

                if (isSpeakingModule) setTimeout(() => startSpeakingFlow(newIdx), 200);

              }}

            >

              <ChevronLeft size={16} /> Previous

            </button>

            <button

              className="btn-primary"

              disabled={isSpeakingModule && sequenceStep !== 'complete' && sequenceStep !== 'idle'}

              onClick={() => {

                if (isLast) {

                  cancelSpeakingFlow();

                  submitAll();

                } else {

                  const newIdx = currentIdx + 1;

                  cancelSpeakingFlow();

                  setCurrentIdx(newIdx);

                  if (isSpeakingModule) setTimeout(() => startSpeakingFlow(newIdx), 200);

                }

              }}

            >

              {isLast ? 'Complete Test' : <>Next Question <ChevronRight size={16} /></>}

            </button>

          </div>

        </section>

      </main>

      

      {isSecurityLocked && (

        <div className="security-gate-overlay fade-in">

          <div className="security-gate-card">

             <AlertTriangle size={64} color="#ef4444" />

             <h2>Security Lock Active</h2>

             <p>The assessment was locked because you exited fullscreen mode, switched tabs, or lost focus.</p>

             <button 

               onClick={() => {

                 const el = document.documentElement;

                 if (!document.fullscreenElement) {

                    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});

                 }

                 setIsSecurityLocked(false);

               }} 

               className="btn-primary"

             >

               Re-enter & Resume

             </button>

             <span className="security-note">Violation logged: focus change detected.</span>

          </div>

        </div>

      )}



      {isCalcOpen && <Calculator onClose={() => setIsCalcOpen(false)} />}



      <style>{`

        .test-wrapper { min-height: 100vh; background: #f8fafc; }

        .test-header { height: 70px; padding: 0 40px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; background: white; border-bottom: 1px solid rgba(0,0,0,0.05); }

        .test-info { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #1e293b; }

        .timer-box { display: flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 8px 16px; border-radius: 12px; font-weight: 700; color: #475569; transition: all 0.3s; }

        .timer-box.warning { background: #fef2f2; color: #ef4444; animation: pulse 1s infinite; }

        

        .btn-calc-toggle {

          display: flex;

          align-items: center;

          gap: 8px;

          padding: 8px 16px;

          background: #fff;

          border: 1.5px solid #e2e8f0;

          border-radius: 10px;

          color: #475569;

          font-weight: 600;

          font-size: 14px;

          cursor: pointer;

          transition: all 0.2s;

        }

        .btn-calc-toggle:hover {

          background: #f8fafc;

          border-color: #cbd5e1;

          color: #1e293b;

        }

        .btn-calc-toggle.active {

          background: #1e293b;

          border-color: #1e293b;

          color: #fff;

        }



        .test-container { flex:1; display:grid; grid-template-columns:200px 1fr; gap:15px; padding:15px; max-width:1200px; margin:0 auto; width:100%; }

        .question-nav { background:white; border-radius:var(--radius-sm); padding:15px; display:flex; flex-direction:column; }

        .question-nav h3 { font-size:14px; margin-bottom:10px; }

        .q-dots { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:10px 0; }

        .q-dot { height:28px; border:1px solid var(--border); border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:11px; background:white; }

        .q-dot.active { background:var(--primary); color:white; border-color:var(--primary); }

        .q-dot.answered { background:#f0fdf4; color:var(--success); border-color:#dcfce7; }

        .question-area { background:white; display:flex; flex-direction:column; padding:20px; }

        .q-header { display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px; }

        .q-num { font-size:12px; font-weight:600; color:var(--secondary); }

        .q-pts { background:#eaf5f5; color:var(--primary); padding:2px 8px; border-radius:40px; font-size:10px; font-weight:700; }

        .q-text { font-size:15px; font-weight:500; line-height:1.5; margin-bottom:20px; }

        .q-options { display:flex; flex-direction:column; gap:8px; }

        .opt-label { padding:10px 14px; border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; gap:12px; font-size:13px; transition:all 0.2s; }

        .opt-label:hover { border-color:var(--primary); background:#f8fafc; }

        .opt-label.selected { border-color:var(--primary); background:#eaf5f5; }

        .opt-label.is-right { border-color:#10b981; background:#f0fdf4; box-shadow: 0 0 0 1px #10b981; }

        .opt-label.is-wrong { border-color:#ef4444; background:#fef2f2; box-shadow: 0 0 0 1px #ef4444; }

        .opt-select { width:100%; padding:10px 14px; border:1px solid var(--border); border-radius:var(--radius-sm); font-size:13px; background:white; outline:none; cursor:pointer; }

        .opt-select:focus { border-color:var(--primary); box-shadow:0 0 0 2px rgba(0, 115, 115,0.1); }

        .writing-container { width: 100%; display: flex; flex-direction: column; }

        .writing-input { width: 100%; height: 200px; resize: none; padding: 15px; font-size: 15px; border: 1.5px solid #e2e8f0; border-radius: 12px; transition: all 0.2s; background: #fbfcfe; }

        .writing-input:focus { border-color: #008a8a; background: #fff; box-shadow: 0 0 0 4px rgba(0, 138, 138, 0.1); outline: none; }

        .char-counter { text-align: right; margin-top: 8px; font-size: 13px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 4px 12px; border-radius: 6px; align-self: flex-end; border: 1px solid #e2e8f0; }

        .speaking-ui { display:flex; flex-direction:column; align-items:center; padding:30px; gap:20px; }

        .flow-indicator { margin-bottom:10px; }

        .status-pill { padding:8px 20px; border-radius:50px; font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px; box-shadow:0 4px 10px rgba(0,0,0,0.05); }

        .status-pill.tts { background:#eaf5f5; color:#007373; border:1px solid #b8dede; }

        .status-pill.audio { background:#fefce8; color:#a16207; border:1px solid #fef08a; }

        .status-pill.recording { background:#fef2f2; color:#ef4444; border:1px solid #fecaca; animation:blink 1s infinite; }

        .status-pill.idle { background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.6} }

        .rec-btn { width:140px; height:140px; border-radius:50%; background:#f1f5f9; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:#64748b; transition:all 0.3s; border:4px solid #e2e8f0; font-size:13px; font-weight:600; }

        .rec-btn.active { background:#fee2e2; color:#ef4444; border-color:#fecaca; transform:scale(1.05); box-shadow:0 0 30px rgba(239,68,68,0.2); }

        .q-footer { margin-top:auto; padding-top:20px; display:flex; justify-content:space-between; align-items:center; }

        .test-header .btn-primary.submit-final { padding:4px 12px; font-size:12px; }

        .q-footer .btn-primary, .q-footer .btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:6px 16px; font-size:13px; }

        .test-guidelines { margin-top:auto; display:flex; gap:4px; align-items:flex-start; font-size:10px; color:var(--secondary); }

        

        /* Security Styles */

        .test-container { user-select: none; -webkit-user-select: none; position: relative; }

        .test-container textarea { user-select: auto; -webkit-user-select: auto; }

        

        .security-gate-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.98); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }

        .security-gate-card { background: white; padding: 40px; border-radius: 24px; text-align: center; max-width: 450px; display: flex; flex-direction: column; align-items: center; gap: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }

        .security-gate-card h2 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }

        .security-gate-card p { color: #64748b; line-height: 1.6; margin: 0; }

        .security-note { font-size: 11px; color: #ef4444; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }



        .finish-ui { height:100vh; display:flex; align-items:center; justify-content:center; background:#f8fafc; }

        .finish-ui .card { text-align:center; padding:30px; max-width:400px; display:flex; flex-direction:column; align-items:center; gap:15px; }

        .countdown-display { background:#fff1f2; padding:8px 16px; border-radius:20px; border:1px solid #fecaca; }

        .pulse { animation:pulse-scale 1.5s infinite; }

        @keyframes pulse-scale { 0%{transform:scale(1);opacity:1} 50%{transform:scale(1.1);opacity:0.8} 100%{transform:scale(1);opacity:1} }

        @keyframes bounce-in { 0%{transform:scale(0.8);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }



        /* Drag & Drop */

        .dd-item { background:white; padding:12px; border-radius:8px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.05); cursor:grab; display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; color:#1e293b; user-select:none; }

        .dd-item:active { cursor:grabbing; }

        .dd-item.dragging { opacity:0.5; }

        

        /* Drag & Drop Slots */

        .dd-slots-layout { animation: fadeIn 0.5s ease; }

        .dd-slot-item { transition: transform 0.2s, box-shadow 0.2s; }

        .dd-slot-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #008a8a; }

        .dd-slot-item.dragging { opacity: 0.5; transform: scale(1.02); }

        .dd-slot-item.in-slot { margin-bottom: 0; border: none; box-shadow: none; width: 100%; }

        .slots-container { border-radius: 12px; }

        

        .dd-slots-right { position: sticky; top: 100px; height: fit-content; border: 1px solid #e2e8f0; }

        

        .playback-preview { margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }



        /* Audio Indicator & Visualizer */

        .now-playing-badge { display: flex; align-items: center; gap: 8px; background: #f0fdf4; color: #16a34a; padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 700; border: 1px solid #bbfcce; animation: fadeIn 0.3s ease; }

        .now-playing-badge.active { animation: badgePulse 2s infinite; }

        .audio-visualizer { display: flex; align-items: flex-end; gap: 2px; height: 12px; }

        .audio-visualizer span { width: 3px; background: #16a34a; border-radius: 1px; animation: barGrow 0.8s infinite ease-in-out; }

        .audio-visualizer span:nth-child(1) { height: 40%; animation-delay: 0s; }

        .audio-visualizer span:nth-child(2) { height: 100%; animation-delay: 0.2s; }

        .audio-visualizer span:nth-child(3) { height: 60%; animation-delay: 0.4s; }

        .audio-visualizer span:nth-child(4) { height: 80%; animation-delay: 0.6s; }

        .stop-icon { width: 10px; height: 10px; background: white; border-radius: 2px; }



        @keyframes barGrow { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.5); } }

        @keyframes badgePulse { 0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(22, 163, 74, 0); } 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); } }

        @keyframes fadeIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }

      `}</style>

    </div>

  );

};



export default TestPlayer;