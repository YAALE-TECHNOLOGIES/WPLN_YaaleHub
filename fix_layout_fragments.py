import re

path = r'frontend/src/pages/ResultEvaluation.jsx'
content = open(path, 'r', encoding='utf-8').read()

# TICK_CROSS_BUTTONS HTML (Correctly used inside a Fragment)
# We'll wrap the Writing block and Speaking block within Fragements to avoid PARSE_ERROR

# ── Fix 2: Writing buttons (Using Fragment) ───────────────────
old_writing_pattern = r'<div\s+className="writing-preview">\{ans\.text_response\}</div>\s+!\s*selectedAttempt\.is_locked\s+&&[^<]+'
# Wait, let's just do a clean replacement of the whole block for safety.

# 370: {ans.question_type === 'WRITING_PROMPT' ? (
# 371:   <div className="writing-preview">{ans.text_response}</div>
# 372:   {!selectedAttempt.is_locked && ( ... ) }
# 373: ) : ...

# Let's use a simpler regex to identify the entire contents of the ternary branch
writing_target = r'(\{ans\.question_type\s*===\s*\'WRITING_PROMPT\'\s*\?\s*\(\s*)(<div\s+className="writing-preview">\{ans\.text_response\}</div>[^:]+)(:\s+ans\.question_type\s*===\s*\'SPEAKING_PROMPT\')'

def wrap_writing(match):
    start = match.group(1) # {ans.question_type === 'WRITING_PROMPT' ? (
    body = match.group(2)  # My broken code
    end = match.group(3)   # : ans.question_type === 'SPEAKING_PROMPT'
    
    # We'll clean up the body and wrap it correctly in a fragment
    new_body = """<>
                        <div className="writing-preview">{ans.text_response}</div>
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
                        )}
                      </>
                   )"""
    return start + new_body + end

new_content = re.sub(writing_target, wrap_writing, content, count=1, flags=re.DOTALL)

# ── Fix 3: Speaking buttons (Using Fragment) ──────────────────
speaking_target = r'(\{ans\.question_type\s*===\s*\'SPEAKING_PROMPT\'\s*\?\s*\(\s*)(<div\s+className="audio-preview">.*?</div>[^:]+)(:\s+ans\.question_type\s*===\s*\'DRAG_DROP_ORDERING\')'

def wrap_speaking(match):
    start = match.group(1)
    body = match.group(2)
    end = match.group(3)
    
    # Extract just the audio preview div
    audio_div_match = re.search(r'<div\s+className="audio-preview">.*?</div>', body, re.DOTALL)
    audio_div = audio_div_match.group(0) if audio_div_match else "<div className=\"audio-preview\">Could not parse</div>"
    
    new_body = f"""<>
                        {audio_div}
                        {'{!selectedAttempt.is_locked && ('}
                          <div style={{{'display:\'flex\',gap:\'12px\',marginTop:\'16px\',paddingTop:\'16px\',borderTop:\'1px solid #f1f5f9\',alignItems:\'center\''}}}>
                            <span style={{{'fontSize:\'13px\',color:\'#64748b\',fontWeight:\'600\''}}}>Mark as:</span>
                            <button onClick={() => {'{ setManualMarks({...manualMarks,[ans.question_id]:true}); setScores({...scores,[ans.question_id]:ans.question_marks}); }'}}
                              style={{{'padding:\'8px 20px\',borderRadius:\'10px\',border:\'none\',cursor:\'pointer\',fontWeight:\'700\',fontSize:\'14px\',transition:\'all 0.2s\',
                                background:manualMarks[ans.question_id]===true?\'#16a34a\':\'#f0fdf4\',color:manualMarks[ans.question_id]===true?\'white\':\'#16a34a\''}}}>
                              &#10003; Correct</button>
                            <button onClick={() => {'{ setManualMarks({...manualMarks,[ans.question_id]:false}); setScores({...scores,[ans.question_id]:0}); }'}}
                              style={{{'padding:\'8px 20px\',borderRadius:\'10px\',border:\'none\',cursor:\'pointer\',fontWeight:\'700\',fontSize:\'14px\',transition:\'all 0.2s\',
                                background:manualMarks[ans.question_id]===false?\'#ef4444\':\'#fef2f2\',color:manualMarks[ans.question_id]===false?\'white\':\'#ef4444\''}}}>
                              &#10007; Incorrect</button>
                          </div>
                        {')}'}
                      </>
                   )"""
    return start + new_body + end

new_content = re.sub(speaking_target, wrap_speaking, new_content, count=1, flags=re.DOTALL)

if new_content != content:
    open(path, 'w', encoding='utf-8').write(new_content)
    print("SUCCESS - layout fixed with fragments")
else:
    print("NOT FOUND - No changes made")
