from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import datetime

from ..database import get_db
from ..models.models import User, Module, Question, QuestionOption, TestAttempt, UserAnswer, AttemptStatus, QuestionType, Syllabus, SpeakingAnswer, SpeakingResult
from .auth_router import get_current_user
from ..schemas import Module as ModuleSchema, TestAttempt as AttemptSchema, Question as QuestionSchema, Syllabus as SyllabusSchema

router = APIRouter()

@router.get("/modules", response_model=List[ModuleSchema])
def get_modules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_set = current_user.assigned_set or 'set1'
    modules = db.query(Module).all()
    for module in modules:
        module.question_count = db.query(Question).filter(
            Question.module_id == module.id,
            func.coalesce(Question.question_set, 'set1') == current_set,
            Question.question_type != QuestionType.QUESTION_FORM,
            ~((Question.question_type == QuestionType.AUDIO_MCQ) & (Question.display_type == 'prompt'))
        ).count()
    return modules

@router.get("/my-attempts", response_model=List[AttemptSchema])
def get_my_attempts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    # Do NOT joinedload answers here, we will build them manually for parity
    attempts = db.query(TestAttempt).options(
        joinedload(TestAttempt.module)
    ).filter(TestAttempt.user_id == current_user.id).all()
    
    final_attempts = []
    current_set = current_user.assigned_set or 'set1'
    attempts = [a for a in attempts if (a.question_set or 'set1') == current_set]
    for a in attempts:
        # Build complete answer list for completed results
        module_questions = db.query(Question).filter(Question.module_id == a.module_id, Question.question_set == (a.question_set or 'set1')).order_by(Question.order_index, Question.id).all()
        
        # Calculate real total possible marks (excluding instructional/prompt-only items)
        total_possible = sum(q.marks for q in module_questions if q.question_type != QuestionType.QUESTION_FORM and not (q.question_type == QuestionType.AUDIO_MCQ and q.display_type == 'prompt'))

        # Create a dict base for serialization
        attempt_data = {
            "id": a.id,
            "user_id": a.user_id,
            "module_id": a.module_id,
            "question_set": a.question_set,
            "status": a.status,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "total_score": a.total_score,
            "is_passed": a.is_passed,
            "is_published": a.is_published,
            "module_name": a.module.name if a.module else "Unknown",
            "total_possible": total_possible,
            "answers": []
        }
        real_answers = db.query(UserAnswer).filter(UserAnswer.attempt_id == a.id).all()
        answer_map = {ans.question_id: ans for ans in real_answers}
        
        complete_answers = []
        for q in module_questions:
            # Skip instructional/prompt-only items in detailed result view
            if q.question_type == QuestionType.QUESTION_FORM or (q.question_type == QuestionType.AUDIO_MCQ and q.display_type == 'prompt'):
                continue
            
            ans = answer_map.get(q.id)
            if ans:
                complete_answers.append({
                    "id": ans.id,
                    "question_id": ans.question_id,
                    "marks_obtained": ans.marks_obtained,
                    "evaluation_status": ans.evaluation_status,
                    "time_taken": ans.time_taken,
                    "text_response": ans.text_response,
                    "audio_response_path": ans.audio_response_path
                })
            else:
                complete_answers.append({
                    "id": None,
                    "question_id": q.id,
                    "marks_obtained": 0,
                    "evaluation_status": "wrong",
                    "time_taken": 0,
                    "text_response": None,
                    "audio_response_path": None
                })
        attempt_data["answers"] = complete_answers
        
        final_attempts.append(attempt_data)
        
    return final_attempts

@router.get("/module/{module_id}", response_model=ModuleSchema)
def get_module(module_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    current_set = current_user.assigned_set or 'set1'
    module.question_count = db.query(Question).filter(
        Question.module_id == module_id,
        func.coalesce(Question.question_set, 'set1') == current_set,
        Question.question_type != QuestionType.QUESTION_FORM,
        ~((Question.question_type == QuestionType.AUDIO_MCQ) & (Question.display_type == 'prompt'))
    ).count()
    return module

@router.post("/start-test/{module_id}", response_model=AttemptSchema)
def start_test(module_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if module exists
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Check if there is an active/completed attempt
    current_set = current_user.assigned_set or 'set1'
    attempt = db.query(TestAttempt).filter(
        TestAttempt.user_id == current_user.id,
        TestAttempt.module_id == module_id,
        func.coalesce(TestAttempt.question_set, 'set1') == current_set
    ).order_by(TestAttempt.id.desc()).first()
    
    if attempt:
        if attempt.status == AttemptStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="You have already completed this test for your assigned set.")
        if attempt.status == AttemptStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="You have already started this test and it is not yet submitted.")
        raise HTTPException(status_code=400, detail="A test attempt already exists for this module and assigned set.")
    
    attempt = TestAttempt(
        user_id=current_user.id,
        module_id=module_id,
        question_set=current_set,
        status=AttemptStatus.IN_PROGRESS,
        start_time=datetime.datetime.now()
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    
    return attempt

@router.get("/questions/{module_id}", response_model=List[QuestionSchema])
def get_questions(module_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify the user has a test attempt in progress for this module
    attempt = db.query(TestAttempt).filter(
        TestAttempt.user_id == current_user.id,
        TestAttempt.module_id == module_id,
        TestAttempt.status == AttemptStatus.IN_PROGRESS
    ).first()
    
    if not attempt:
        raise HTTPException(status_code=403, detail="No active test attempt for this module")
    
    question_set = attempt.question_set or 'set1'
    return db.query(Question).filter(Question.module_id == module_id, func.coalesce(Question.question_set, 'set1') == question_set).all()

@router.post("/submit-answer")
def submit_answer(
    attempt_id: int = Form(...),
    question_id: int = Form(...),
    selected_option_id: Optional[int] = Form(None),
    text_response: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify attempt belongs to user
    attempt = db.query(TestAttempt).filter(
        TestAttempt.id == attempt_id, 
        TestAttempt.user_id == current_user.id
    ).first()
    
    if not attempt or attempt.status != AttemptStatus.IN_PROGRESS:
        raise HTTPException(status_code=403, detail="Invalid attempt or status")
    
    # Upsert user answer
    answer = db.query(UserAnswer).filter(
        UserAnswer.attempt_id == attempt_id,
        UserAnswer.question_id == question_id
    ).first()
    
    if not answer:
        answer = UserAnswer(attempt_id=attempt_id, question_id=question_id)
        db.add(answer)
    
    if selected_option_id is not None:
        print(f"DEBUG: Saving Answer for Attempt {attempt_id}, Question {question_id}, OptionID {selected_option_id}")
        answer.selected_option_id = selected_option_id
    if text_response is not None:
        answer.text_response = text_response
    
    if audio_file:
        file_ext = audio_file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        save_path = f"uploads/speaking/{file_name}"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(audio_file.file.read())
        answer.audio_response_path = save_path
        
    db.commit()
    return {"message": "Answer saved successfully"}

@router.post("/complete-test/{attempt_id}")
def complete_test(attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(TestAttempt).filter(
        TestAttempt.id == attempt_id, 
        TestAttempt.user_id == current_user.id
    ).first()
    
    if not attempt or attempt.status not in [AttemptStatus.IN_PROGRESS, AttemptStatus.COMPLETED]:
        raise HTTPException(status_code=403, detail="Invalid attempt or status")
    
    try:
        # Auto-evaluation for deterministic questions
        module_questions = db.query(Question).filter(Question.module_id == attempt.module_id, Question.question_set == attempt.question_set).order_by(Question.order_index, Question.id).all()
        
        total_obtained = 0
        total_possible = 0
        needs_manual = False
        writing_questions_payload = []
        speaking_questions_payload = []
        q_num_counter = 1
        s_num_counter = 1
        last_question_form_text = ""
        for q in module_questions:
            if q.question_type == QuestionType.QUESTION_FORM or (q.question_type == QuestionType.AUDIO_MCQ and q.display_type == 'prompt'):
                if q.question_type == QuestionType.QUESTION_FORM:
                    last_question_form_text = q.question_text
                continue

            total_possible += q.marks
            answer = db.query(UserAnswer).filter(
                UserAnswer.attempt_id == attempt_id,
                UserAnswer.question_id == q.id
            ).first()
            
            if q.question_type in [QuestionType.MCQ, QuestionType.AUDIO_MCQ]:
                correct_option = db.query(QuestionOption).filter(
                    QuestionOption.question_id == q.id, 
                    QuestionOption.is_correct == True
                ).first()
                if answer and correct_option and answer.selected_option_id == correct_option.id:
                    answer.marks_obtained = q.marks
                    answer.evaluation_status = "correct"
                    total_obtained += q.marks
                else:
                    if answer:
                        answer.marks_obtained = 0
                        answer.evaluation_status = "wrong"
                    
            elif q.question_type in [QuestionType.DRAG_DROP_ORDERING, QuestionType.DRAG_DROP_SLOTS]:
                import json
                try:
                    if answer and answer.text_response:
                        user_order = json.loads(answer.text_response)
                        items = q.drag_drop_data.get('items', [])
                        actual_order_sequence = []
                        for idx in user_order:
                            if idx is not None and isinstance(idx, int) and idx < len(items):
                                item = items[idx]
                                if isinstance(item, dict):
                                    actual_order_sequence.append(item.get('order', 0))
                                else:
                                    actual_order_sequence.append(idx + 1)
                            else:
                                actual_order_sequence.append(0)
                        
                        if not actual_order_sequence or any(o == 0 for o in actual_order_sequence):
                            answer.marks_obtained = 0
                            answer.evaluation_status = "wrong"
                        else:
                            all_item_orders = sorted([it.get('order', 0) if isinstance(it, dict) else (i + 1) for i, it in enumerate(items)])
                            expected_sequence = all_item_orders
                            if actual_order_sequence == expected_sequence:
                                answer.marks_obtained = q.marks
                                answer.evaluation_status = "correct"
                                total_obtained += q.marks
                            else:
                                answer.marks_obtained = 0
                                answer.evaluation_status = "wrong"
                    else:
                        if answer:
                            answer.marks_obtained = 0
                            answer.evaluation_status = "wrong"
                except Exception as e:
                    print(f"Error evaluating D&D Ordering question {q.id}: {e}")
                    if answer:
                        answer.marks_obtained = 0
                        answer.evaluation_status = "wrong"

            elif q.question_type == QuestionType.WRITING_PROMPT:
                writing_questions_payload.append({
                    "q_num": q_num_counter,
                    "question_id": q.id,
                    "question_text": q.question_text,
                    "context_text": last_question_form_text,
                    "user_answer": (answer.text_response or "") if answer else "",
                    "max_marks": q.marks,
                    "media_url": q.media_url
                })
                q_num_counter += 1

            elif q.question_type == QuestionType.SPEAKING_PROMPT:
                if answer and answer.audio_response_path:
                    try:
                        from ..services.speaking_evaluator import transcribe_audio
                        existing_sa = db.query(SpeakingAnswer).filter(
                            SpeakingAnswer.test_id == attempt_id,
                            SpeakingAnswer.question_id == q.id
                        ).first()
                        
                        if not existing_sa:
                            text = transcribe_audio(answer.audio_response_path)
                            existing_sa = SpeakingAnswer(
                                user_id=current_user.id,
                                test_id=attempt_id,
                                question_id=q.id,
                                transcribed_text=text,
                                audio_path=answer.audio_response_path
                            )
                            db.add(existing_sa)
                            db.flush()
                            db.refresh(existing_sa)
                        
                        speaking_questions_payload.append({
                            "q_num": s_num_counter,
                            "question_id": q.id,
                            "question_text": q.question_text,
                            "context_text": last_question_form_text,
                            "transcribed_text": existing_sa.transcribed_text,
                            "max_marks": q.marks,
                            "media_url": q.media_url
                        })
                        s_num_counter += 1
                    except Exception as e:
                        print(f"Error transcribing speaking question {q.id}: {e}")
                        needs_manual = True
                else:
                    # No audio recorded: force 0 score, don't send to GPT
                    db.add(SpeakingResult(
                        user_id=current_user.id,
                        test_id=attempt_id,
                        question_id=q.id,
                        obtained_marks=0.0,
                        max_marks=q.marks,
                        total_score=0.0 # Will be updated later if needed, or just left
                    ))
                    if not answer:
                        answer = UserAnswer(attempt_id=attempt_id, question_id=q.id)
                        db.add(answer)
                    answer.marks_obtained = 0.0
                    answer.evaluation_status = "wrong"
                    # We do NOT append to speaking_questions_payload to save tokens & prevent hallucinations
                    s_num_counter += 1

            else:
                needs_manual = True

        # ── GPT Writing Evaluation ─────────────────────────────────────────
        if writing_questions_payload:
            try:
                from ..services.writing_evaluator import evaluate_writing
                eval_result = evaluate_writing(writing_questions_payload)
                writing_total = eval_result.get("_total", 0.0)
                total_obtained += writing_total
                for wq in writing_questions_payload:
                    q_id = wq["question_id"]
                    obtained = eval_result.get(q_id, 0.0)
                    ans = db.query(UserAnswer).filter(
                        UserAnswer.attempt_id == attempt_id,
                        UserAnswer.question_id == q_id
                    ).first()
                    if not ans:
                        ans = UserAnswer(attempt_id=attempt_id, question_id=q_id)
                        db.add(ans)
                        
                    ans.marks_obtained = obtained
                    ans.evaluation_status = "correct" if obtained >= (wq["max_marks"] * 0.5) else "wrong"
                print(f"GPT Writing eval complete. Total writing score: {writing_total}")
            except Exception as e:
                print(f"GPT Writing evaluation error (non-fatal): {e}")
                needs_manual = True

        # ── GPT Speaking Evaluation ────────────────────────────────────────
        if speaking_questions_payload:
            try:
                from ..services.speaking_evaluator import evaluate_speaking
                eval_result = evaluate_speaking(speaking_questions_payload)
                speaking_total = eval_result.get("_total", 0.0)
                total_obtained += speaking_total
                db.query(SpeakingResult).filter(SpeakingResult.test_id == attempt_id).delete()
                for sq in speaking_questions_payload:
                    q_id = sq["question_id"]
                    obtained = eval_result.get(q_id, 0.0)
                    db.add(SpeakingResult(
                        user_id=current_user.id,
                        test_id=attempt_id,
                        question_id=q_id,
                        obtained_marks=obtained,
                        max_marks=sq["max_marks"],
                        total_score=speaking_total
                    ))
                    ans = db.query(UserAnswer).filter(
                        UserAnswer.attempt_id == attempt_id,
                        UserAnswer.question_id == q_id
                    ).first()
                    if not ans:
                        ans = UserAnswer(attempt_id=attempt_id, question_id=q_id)
                        db.add(ans)
                    
                    ans.marks_obtained = obtained
                    ans.evaluation_status = "correct" if obtained >= (sq["max_marks"] * 0.5) else "wrong"
                print(f"GPT Speaking eval complete. Total speaking score: {speaking_total}")
            except Exception as e:
                print(f"GPT Speaking evaluation error (non-fatal): {e}")
                needs_manual = True

        db.flush()
        attempt.total_score = total_obtained
        score_percent = (total_obtained / total_possible * 100) if total_possible > 0 else 0
        attempt.is_passed = score_percent >= attempt.module.pass_marks
        if not needs_manual:
            attempt.is_locked = True

    except Exception as e:
        # Catch-all: log the error but still complete the attempt
        print(f"CRITICAL ERROR in complete_test (attempt {attempt_id}): {e}")
        import traceback; traceback.print_exc()
        total_obtained = 0
        total_possible = 1

    # Always mark as COMPLETED and commit — never drop the connection
    attempt.status = AttemptStatus.COMPLETED
    attempt.end_time = attempt.end_time or datetime.datetime.now()
    try:
        db.commit()
    except Exception as commit_err:
        print(f"COMMIT FAILED for attempt {attempt_id}: {commit_err}")
        import traceback; traceback.print_exc()
        db.rollback()
        # Minimal safe commit: just mark attempt as completed
        attempt.status = AttemptStatus.COMPLETED
        attempt.end_time = attempt.end_time or datetime.datetime.now()
        db.commit()

    return {
        "message": "Test completed successfully",
        "total_score": float(attempt.total_score or 0),
        "is_passed": bool(attempt.is_passed),
        "total_possible": float(attempt.module.total_marks or 0)
    }



@router.get("/my-attempt/{attempt_id}")
def get_my_attempt_detail(attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id, TestAttempt.user_id == current_user.id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    # Always allow access to completed attempts
    from sqlalchemy.orm import selectinload, joinedload
    question_set = attempt.question_set or 'set1'
    questions = db.query(Question).options(selectinload(Question.options)).filter(
        Question.module_id == attempt.module_id,
        func.coalesce(Question.question_set, 'set1') == question_set
    ).order_by(Question.order_index, Question.id).all()
    user_answers = db.query(UserAnswer).filter(UserAnswer.attempt_id == attempt_id).all()
    answer_map = {a.question_id: a for a in user_answers}
    
    response_answers = []
    for q in questions:
        if q.question_type == QuestionType.QUESTION_FORM or (q.question_type == QuestionType.AUDIO_MCQ and q.display_type == 'prompt'):
            continue
            
        a = answer_map.get(q.id)
        response_answers.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "question_marks": q.marks,
            "marks_obtained": float(a.marks_obtained) if a and a.marks_obtained is not None else 0,
            "text_response": a.text_response if a else None,
            "evaluation_status": a.evaluation_status if a else "wrong"
        })
    
    return {
        "id": attempt.id,
        "module_name": attempt.module.name,
        "status": attempt.status,
        "total_score": attempt.total_score,
        "total_possible": sum(q.marks for q in questions if q.question_type != QuestionType.QUESTION_FORM and not (q.question_type == QuestionType.AUDIO_MCQ and q.display_type == 'prompt')),
        "is_passed": attempt.is_passed,
        "is_published": True,
        "proficiency_mapping": attempt.module.proficiency_mapping,
        "answers": response_answers
    }

@router.get("/syllabus", response_model=List[SyllabusSchema])
def list_syllabus(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Syllabus).order_by(Syllabus.id.desc()).all()


@router.post("/evaluate-speaking")
def evaluate_speaking_endpoint(
    test_id: int = Form(...),
    question_id: int = Form(...),
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Save and Transcribe
    file_ext = audio_file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{file_ext}"
    save_path = f"uploads/speaking/{file_name}"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    with open(save_path, "wb") as f:
        f.write(audio_file.file.read())

    from ..services.speaking_evaluator import transcribe_audio, evaluate_speaking
    
    try:
        transcribed_text = transcribe_audio(save_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 2. Store transcribed text
    speaking_answer = db.query(SpeakingAnswer).filter(
        SpeakingAnswer.test_id == test_id,
        SpeakingAnswer.question_id == question_id
    ).first()
    
    if not speaking_answer:
        speaking_answer = SpeakingAnswer(
            user_id=current_user.id,
            test_id=test_id,
            question_id=question_id
        )
        db.add(speaking_answer)
    
    speaking_answer.transcribed_text = transcribed_text
    speaking_answer.audio_path = save_path
    db.commit()

    # 2. Validate attempt ownership and set context
    attempt = db.query(TestAttempt).filter(TestAttempt.id == test_id, TestAttempt.user_id == current_user.id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    question_set = attempt.question_set or 'set1'
    module_id = attempt.module_id

    # Validate that the submitted speaking question belongs to this attempt's question set.
    question = db.query(Question).filter(
        Question.id == question_id,
        Question.module_id == module_id,
        func.coalesce(Question.question_set, 'set1') == question_set
    ).first()
    if not question:
        raise HTTPException(status_code=400, detail="Invalid question for this attempt")
    
    # 3. Construct evaluation prompt dynamically from the attempt's assigned set
    all_module_questions = db.query(Question).filter(
        Question.module_id == module_id,
        func.coalesce(Question.question_set, 'set1') == question_set
    ).order_by(Question.order_index, Question.id).all()
    
    # Retrieve all speaking answers for this test
    speaking_answers = db.query(SpeakingAnswer).filter(SpeakingAnswer.test_id == test_id).all()
    
    eval_questions_payload = []
    for idx, sa in enumerate(speaking_answers):
        q = next((qu for qu in all_module_questions if qu.id == sa.question_id), None)
        if q:
            # Find last QUESTION_FORM before this question
            context = ""
            for prev_q in all_module_questions:
                if prev_q.order_index >= q.order_index: break
                if prev_q.question_type == QuestionType.QUESTION_FORM:
                    context = prev_q.question_text

            eval_questions_payload.append({
                "q_num": idx + 1,
                "question_id": q.id,
                "question_text": q.question_text,
                "context_text": context,
                "transcribed_text": sa.transcribed_text,
                "max_marks": q.marks,
                "media_url": q.media_url
            })

    # 4. Evaluate using GPT
    try:
        eval_result = evaluate_speaking(eval_questions_payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 5. Store marks in speaking_results
    total_speaking_score = eval_result.get("_total", 0.0)
    
    # Clear old results for this test to avoid duplicates if re-evaluating
    db.query(SpeakingResult).filter(SpeakingResult.test_id == test_id).delete()
    
    scores_dict = {}
    for eq in eval_questions_payload:
        q_id = eq["question_id"]
        marks = eval_result.get(q_id, 0.0)
        
        speaking_res = SpeakingResult(
            user_id=current_user.id,
            test_id=test_id,
            question_id=q_id,
            obtained_marks=marks,
            max_marks=eq["max_marks"],
            total_score=total_speaking_score
        )
        db.add(speaking_res)
        
        # Also update UserAnswer for the main result flow
        ans = db.query(UserAnswer).filter(
            UserAnswer.attempt_id == test_id,
            UserAnswer.question_id == q_id
        ).first()
        if ans:
            ans.marks_obtained = marks
            ans.evaluation_status = "correct" if marks >= (eq["max_marks"] * 0.5) else "wrong"
            
        scores_dict[f"Q{eq['q_num']}"] = f"{marks}/{eq['max_marks']}"

    db.commit()

    return {
        "transcribed_text": transcribed_text,
        "scores": scores_dict,
        "total_speaking_score": total_speaking_score
    }
