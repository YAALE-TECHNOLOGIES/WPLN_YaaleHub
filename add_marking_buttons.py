import re

path = r'frontend/src/pages/ResultEvaluation.jsx'
content = open(path, 'r', encoding='utf-8').read()

# TICK_CROSS_BUTTONS HTML
TICK_CROSS_BUTTONS = """
                      {!selectedAttempt.is_locked && (
                        <div style={{display:'flex',gap:'12px',marginTop:'16px',paddingTop:'16px',borderTop:'1px solid #f1f5f9',alignItems:'center'}}>
                          <span style={{fontSize:'13px',color:'#64748b',fontWeight:'600'}}>Mark as:</span>
                          <button onClick={() => { setManualMarks({...manualMarks,[ans.question_id]:true}); setScores({...scores,[ans.question_id]:ans.question_marks}); }}
                            style={{padding:'8px 20px',borderRadius:'10px',border:'none',cursor:'pointer',fontWeight:'700',fontSize:'14px',transition:'all 0.2s',
                              background:manualMarks[ans.question_id]===true?'#16a34a':'#f0fdf4',color:manualMarks[ans.question_id]===true?'white':'#16a34a'}}>
                            &#10003; Correct</button>
                          <button onClick={() => { setManualMarks({...manualMarks,[ans.question_id]:false}); setScores({...scores,[ans.question_id]:0}); }}
                            style={{padding:'8px 20px',borderRadius:'10px',border:'none',cursor:'pointer',fontWeight:'700',fontSize:'14px',transition:'all 0.2s',
                              background:manualMarks[ans.question_id]===false?'#ef4444':'#fef2f2',color:manualMarks[ans.question_id]===false?'white':'#ef4444'}}>
                            &#10007; Incorrect</button>
                        </div>
                      )}"""

# ── Fix 2: Writing buttons ──────────────
# Replace: <div className="writing-preview">{ans.text_response}</div>
# Note: we need to handle variations in whitespace.
old_writing_pattern = r'<div\s+className="writing-preview">\{ans\.text_response\}</div>'
new_writing = '<div className="writing-preview">{ans.text_response}</div>' + TICK_CROSS_BUTTONS

new_content = re.sub(old_writing_pattern, new_writing, content, count=1)

# ── Fix 3: Speaking buttons ─────────────
# After: <audio controls src={`${BASE_URL}/${ans.audio_response}`} /> ... </div> (the closure of audio-preview)
# Find the closure of the audio-preview div and insert before it
old_speaking_end_pattern = r'</div>(\s+)\) : ans\.question_type === \'DRAG_DROP_ORDERING\''
new_speaking_end = TICK_CROSS_BUTTONS + r'\n                      </div>\1) : ans.question_type === \'DRAG_DROP_ORDERING\''

new_content = re.sub(old_speaking_end_pattern, new_speaking_end, new_content, count=1)

if new_content != content:
    open(path, 'w', encoding='utf-8').write(new_content)
    print("SUCCESS - marking buttons added")
else:
    print("NOT FOUND")
