import re

path = r'frontend/src/pages/ResultEvaluation.jsx'
content = open(path, 'r', encoding='utf-8').read()

# THE DEFINITIVE FIX:
# We will replace the entire ans-body div with a clean, correctly-parsed version.
# This avoids the regex escaping issues.

# We'll match from line 368 to 461
# {line_num}| {content}

new_ans_body = """                <div className="ans-body">
                   {ans.question_type === 'WRITING_PROMPT' ? (
                      <>
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
                   ) : ans.question_type === 'SPEAKING_PROMPT' ? (
                      <>
                        <div className="audio-preview">
                           {ans.audio_response ? (
                               <>
                                   <audio controls src={`${BASE_URL}/${ans.audio_response}`} />
                                   <a href={`${BASE_URL}/${ans.audio_response}`} className="dl-btn" download><Download size={14}/> Download Audio</a>
                               </>
                           ) : <p className="sub-text">No audio recorded</p>}
                        </div>
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
                   ) : ans.question_type === 'DRAG_DROP_ORDERING' ? (
                      <div className="dd-ordering-preview">
                         {ans.text_response ? (() => {
                             let userOrder = [];
                             try { userOrder = JSON.parse(ans.text_response); } catch(e) { return <p className="sub-text">Malformed result</p>; }
                             const data = ans.drag_drop_data || { items: [] };
                             return (
                                 <div className="ordering-list" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                     {userOrder.map((idx, pos) => {
                                         const isCorrectPos = idx === pos;
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
                                                 <span style={{fontWeight: 700, color: '#64748b', width: '20px'}}>{pos + 1}.</span>
                                                 <span style={{flex: 1}}>{data.items?.[idx] || `Item ${idx}`}</span>
                                                 {!isCorrectPos && <span style={{fontSize: '11px', color: '#ef4444', fontWeight: 600}}>Incorrect Position</span>}
                                             </div>
                                         );
                                     })}
                                 </div>
                             );
                         })() : <p className="sub-text">No answer provided</p>}
                         <span className="auto-msg" style={{marginTop: 10, display: 'block'}}> (Auto-Evaluated)</span>
                      </div>
                   ) : (
                      <div className="mcq-preview">
                         <div className="selected-ans">
                            Candidate Selected: <strong>{ans.selected_option_text || 'No Answer'}</strong>
                            {ans.selected_option_text === ans.correct_option_text ? 
                               <span className="correct-tag" style={{marginLeft: '10px', color: '#16a34a', fontWeight: '800'}}>✓ CORRECT</span> : 
                               <span className="incorrect-tag" style={{marginLeft: '10px', color: '#ef4444', fontWeight: '800'}}>✗ INCORRECT</span>
                            }
                         </div>
                         {ans.selected_option_text !== ans.correct_option_text && (
                            <div className="correct-ans" style={{marginTop: '8px', fontSize: '13px', color: '#64748b'}}>
                               Correct Answer: <strong style={{color: '#16a34a'}}>{ans.correct_option_text}</strong>
                            </div>
                         )}
                         <span className="auto-msg" style={{marginTop: 10, display: 'block'}}> (Auto-Evaluated)</span>
                      </div>
                   )}
                </div>"""

# Match from <div className="ans-body"> until </div> followed by </div> closure
pattern = r'<div\s+className="ans-body">.*?</div>\s+</div>\s+</div>'
# Wait, this matches the wrong end. Let's be safer.

# Match until the style block starts
pattern = r'<div\s+className="ans-body">.*?</div>\s+</div>\s+</div>(?=\s+<style>)'

def replace_with_clean_body(match):
    # Match group 0 is the entire segment. We keep the two closing divs at the end for the outer wrappers.
    return new_ans_body + "\n             </div>\n           </div>"

new_content = re.sub(pattern, replace_with_clean_body, content, count=1, flags=re.DOTALL)

if new_content != content:
    open(path, 'w', encoding='utf-8').write(new_content)
    print("SUCCESS - Resolved all syntax errors")
else:
    print("NOT FOUND - falling back to block replacement")
    # Identify by start/end markers
    start_tag = '<div className="ans-body">'
    end_tag = '</div>\n             </div>\n           </div>\n\n        <style>'
    
    # We'll find the last occurrence of </style> or the start of <style>
    start_idx = content.find(start_tag)
    end_idx = content.find('<style>')
    
    if start_idx != -1 and end_idx != -1:
        # We need to find the closure of the divs before <style>
        # The structure is:
        # <div className="ans-body"> ... </div>
        #   </div> (closes ans-review-card)
        # </div> (closes answers-list)
        segment = content[:start_idx] + new_ans_body + "\n             </div>\n           </div>\n\n        " + content[end_idx:]
        open(path, 'w', encoding='utf-8').write(segment)
        print("SUCCESS - Manual block substitution")
    else:
        print("COULD NOT LOCATE BLOCKS")
