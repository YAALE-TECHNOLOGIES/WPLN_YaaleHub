from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import json
import uuid
import os
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional, Union
import pandas as pd
import io
import datetime

from ..database import get_db
from ..models.models import User, Role, Module, Question, QuestionOption, TestAttempt, UserAnswer, RoleNames, AttemptStatus, QuestionType, EvaluationLog, Syllabus, SpeakingAnswer, SpeakingResult, DisplayType
from .auth_router import get_current_user
from ..schemas import User as UserSchema, UserCreate, UserUpdate, Module as ModuleSchema, Question as QuestionSchema, QuestionCreate, BulkQuestionsCreate, TestAttempt as AttemptSchema, TestAttemptUpdate, Syllabus as SyllabusSchema, PaginatedUsers
from ..core.auth import get_password_hash
from ..services.email_service import send_notification

router = APIRouter()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role.name != RoleNames.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden: Admin access required")
    return current_user

def get_evaluator_user(current_user: User = Depends(get_current_user)):
    if current_user.role.name not in [RoleNames.ADMIN, RoleNames.EVALUATOR]:
        raise HTTPException(status_code=403, detail="Forbidden: Evaluator access required")
    return current_user

@router.get("/users", response_model=Union[List[UserSchema], PaginatedUsers])
def list_users(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_admin_user),
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    user_tab: Optional[str] = None
):
    try:
        if page is None:
            return db.query(User).options(joinedload(User.role)).all()
            
        # Enforce and clamp page_size between 10 and 30 users per page
        if page_size is None:
            page_size = 10
        else:
            page_size = max(10, min(30, page_size))
            
        if page < 1:
            page = 1
            
        query = db.query(User).options(joinedload(User.role))
        
        if search and search.strip():
            search_term = f"%{search.strip()}%"
            query = query.filter(or_(User.fullname.ilike(search_term), User.email.ilike(search_term)))
            
        if user_tab == 'internal':
            query = query.filter(User.role_id.in_([1, 2]))
        elif user_tab == 'candidates':
            query = query.filter(User.role_id == 3)
            
        # Order deterministically by ID to avoid random page overlap
        query = query.order_by(User.id.asc())
        
        total_filtered = query.count()
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        
        # Global counts for stats
        total_users = db.query(User).count()
        candidates_count = db.query(User).filter(User.role_id == 3).count()
        evaluators_count = db.query(User).filter(User.role_id == 2).count()
        
        total_pages = (total_filtered + page_size - 1) // page_size if total_filtered > 0 else 1
        
        # Explicitly validate items to catch errors in the try-except block
        validated_items = [UserSchema.model_validate(item) for item in items]
        
        return {
            "items": validated_items,
            "total": total_filtered,
            "page": page,
            "page_size": page_size,
            "pages": total_pages,
            "total_users": total_users,
            "candidates_count": candidates_count,
            "evaluators_count": evaluators_count
        }
    except Exception as e:
        import traceback
        with open("error_log.txt", "a") as f:
            f.write(f"\nError in list_users at {datetime.datetime.now()}:\n")
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users", response_model=UserSchema)
def create_user(user_data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Check if exists
    normalized_email = user_data.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    user = User(
        fullname=user_data.fullname,
        email=normalized_email,
        password_hash=hashed_password,
        role_id=user_data.role_id,
        batch=user_data.batch,
        education=user_data.education,
        assigned_set=user_data.assigned_set or 'set1'
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Trigger email if role is Candidate
    if user.role_id == 3:
        subject = "Welcome to Skill Bridge Assessment - Yaale Technologies"
        body = f"""Hello {user.fullname},

Your account has been created for the Skill Bridge Assessment Platform by Yaale Technologies.

Login Details:
Email: {user.email}
Password: {user_data.password}

You can log in at: {FRONTEND_URL}/login

Good luck with your assessments!
"""
        send_notification(user.email, subject, body)

    return user

@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_data.email and user_data.email != user.email:
        existing = db.query(User).filter(User.email == user_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_data.email
    if user_data.fullname:
        user.fullname = user_data.fullname
    if user_data.role_id:
        user.role_id = user_data.role_id
    if user_data.batch is not None:
        user.batch = user_data.batch
    if user_data.education is not None:
        user.education = user_data.education
    if user_data.assigned_set is not None:
        old_set = user.assigned_set or 'set1'
        new_set = user_data.assigned_set or 'set1'
        # If set changed OR explicit reset_progress is requested
        if old_set != new_set or user_data.reset_progress:
            # Remove old attempts, answers, evaluations, and speaking records from the previous set
            # If it's a reset, we remove from the current (new) set too
            set_to_clear = old_set if old_set != new_set else new_set
            
            old_attempt_ids = [a[0] for a in db.query(TestAttempt.id).filter(
                TestAttempt.user_id == user.id,
                func.coalesce(TestAttempt.question_set, 'set1') == set_to_clear
            ).all()]
            if old_attempt_ids:
                db.query(UserAnswer).filter(UserAnswer.attempt_id.in_(old_attempt_ids)).delete(synchronize_session=False)
                db.query(EvaluationLog).filter(EvaluationLog.attempt_id.in_(old_attempt_ids)).delete(synchronize_session=False)
                db.query(SpeakingAnswer).filter(SpeakingAnswer.test_id.in_(old_attempt_ids)).delete(synchronize_session=False)
                db.query(SpeakingResult).filter(SpeakingResult.test_id.in_(old_attempt_ids)).delete(synchronize_session=False)
                db.query(TestAttempt).filter(TestAttempt.id.in_(old_attempt_ids)).delete(synchronize_session=False)
        user.assigned_set = user_data.assigned_set
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        # Nullify references if user was an evaluator
        db.query(TestAttempt).filter(TestAttempt.evaluator_id == user_id).update({TestAttempt.evaluator_id: None})
        db.query(UserAnswer).filter(UserAnswer.evaluated_by == user_id).update({UserAnswer.evaluated_by: None})
        db.query(EvaluationLog).filter(EvaluationLog.evaluator_id == user_id).delete()
        
        # Delete user's attempts and associated data
        attempt_ids = [a.id for a in db.query(TestAttempt.id).filter(TestAttempt.user_id == user_id).all()]
        if attempt_ids:
            db.query(UserAnswer).filter(UserAnswer.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(EvaluationLog).filter(EvaluationLog.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(SpeakingAnswer).filter(SpeakingAnswer.test_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(SpeakingResult).filter(SpeakingResult.test_id.in_(attempt_ids)).delete(synchronize_session=False)
            db.query(TestAttempt).filter(TestAttempt.id.in_(attempt_ids)).delete(synchronize_session=False)
            
        # Clean up any lingering speaking records
        db.query(SpeakingAnswer).filter(SpeakingAnswer.user_id == user_id).delete(synchronize_session=False)
        db.query(SpeakingResult).filter(SpeakingResult.user_id == user_id).delete(synchronize_session=False)
        
        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        # Log the actual error for debugging, but return a clean message to UI
        print(f"CRITICAL ERROR DELETING USER: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
    return {"message": "User deleted successfully"}

@router.get("/users/excel-template")
def download_user_excel_template(current_user: User = Depends(get_admin_user)):
    """Download a blank Excel template for bulk user upload."""
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Users Template"

    headers = ["fullname", "email", "password", "role_id", "batch"]
    
    # Style header row
    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    # Examples
    examples = [
        ["John Doe", "john@example.com", "pass123", 3, 2],
        ["Jane Smith", "jane@admin.com", "admin456", 1, None],
    ]
    
    for row_idx, row_data in enumerate(examples, 2):
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.alignment = Alignment(vertical="center")
            cell.border = border

    # Column widths
    ws.column_dimensions["A"].width = 25
    ws.column_dimensions["B"].width = 30
    ws.column_dimensions["C"].width = 15
    ws.column_dimensions["D"].width = 10
    ws.column_dimensions["E"].width = 10

    ws2 = wb.create_sheet("Instructions")
    instructions = [
        ("BULK USER UPLOAD - INSTRUCTIONS", True),
        ("", False),
        ("Column Guide:", True),
        ("fullname → User's full name", False),
        ("email    → User's unique email address", False),
        ("password → Temporary password for login", False),
        ("role_id  → 1: Admin | 3: Candidate", False),
        ("batch    → (Optional) Batch number for candidates", False),
        ("", False),
        ("NOTES:", True),
        ("- All columns are required.", False),
        ("- Role ID must be 1 or 3.", False),
        ("- Do not change column header names.", False),
    ]
    for r, (text, bold) in enumerate(instructions, 1):
        cell = ws2.cell(row=r, column=1, value=text)
        if bold:
            cell.font = Font(bold=True, size=12 if r == 1 else 10)
    ws2.column_dimensions["A"].width = 60

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=user_upload_template.xlsx"}
    )

@router.post("/users/bulk")
def bulk_upload_users(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Load CSV/Excel
    content = file.file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read upload file. Please ensure it is a valid CSV or Excel file. Error: {str(e)}"
        )
    
    # Normalize column names to lowercase and strip whitespaces
    df.columns = [str(col).strip().lower() for col in df.columns]
    
    # Validate that the required columns exist
    required_cols = {'fullname', 'email', 'password'}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_cols)}. Check your file headers."
        )
    
    success_count = 0
    error_msgs = []
    seen_emails = set()
    
    # Query all valid role IDs to validate input values locally
    try:
        valid_role_ids = {r.id for r in db.query(Role).all()}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error while fetching roles: {str(e)}"
        )

    for idx, row in df.iterrows():
        row_num = idx + 2  # Row 1 is header, first data row is 2
        try:
            # Clean and validate email
            email_val = row.get('email')
            if pd.isna(email_val) or not str(email_val).strip():
                error_msgs.append(f"Row {row_num}: Email is required.")
                continue
            email = str(email_val).strip().lower()
            
            # Email regex validation
            import re
            EMAIL_REGEX = r'^[\w\.-]+@[\w\.-]+\.\w+$'
            if not re.match(EMAIL_REGEX, email):
                error_msgs.append(f"Row {row_num}: Invalid email format '{email}'.")
                continue
            
            # Prevent duplicate emails within the uploaded file itself
            if email in seen_emails:
                error_msgs.append(f"Row {row_num}: Duplicate email '{email}' in the uploaded file.")
                continue
            seen_emails.add(email)
            
            # Clean and validate fullname
            fullname_val = row.get('fullname')
            if pd.isna(fullname_val) or not str(fullname_val).strip():
                error_msgs.append(f"Row {row_num}: Full name is required.")
                continue
            fullname = str(fullname_val).strip()
            
            # Clean and validate password
            password_val = row.get('password')
            if pd.isna(password_val) or not str(password_val).strip():
                error_msgs.append(f"Row {row_num}: Password is required.")
                continue
            password = str(password_val).strip()
            
            # Clean and validate role_id
            role_id = 3  # Default to Candidate
            if 'role_id' in row and not pd.isna(row['role_id']):
                try:
                    role_id = int(row['role_id'])
                except (ValueError, TypeError):
                    error_msgs.append(f"Row {row_num}: Invalid role_id format. Must be an integer.")
                    continue
                if role_id not in [1, 3]:
                    error_msgs.append(f"Row {row_num}: Invalid role_id '{role_id}'. Allowed role IDs: [1, 3] (1: Admin, 3: Candidate).")
                    continue
            
            # Clean and validate batch
            batch = None
            if 'batch' in row and not pd.isna(row['batch']):
                try:
                    batch = int(row['batch'])
                except (ValueError, TypeError):
                    error_msgs.append(f"Row {row_num}: Invalid batch format. Must be an integer.")
                    continue
            
            # Use nested transaction savepoint to isolate database insert errors
            with db.begin_nested():
                # Check database uniqueness
                existing_user = db.query(User).filter(User.email == email).first()
                if existing_user:
                    error_msgs.append(f"Row {row_num}: Email '{email}' is already registered in the system.")
                    continue
                
                hashed_pw = get_password_hash(password)
                user = User(
                    fullname=fullname,
                    email=email.strip().lower(),
                    password_hash=hashed_pw,
                    role_id=role_id,
                    batch=batch
                )
                db.add(user)
                success_count += 1
                
                # Trigger welcome email if role is Candidate (role_id == 3)
                if role_id == 3:
                    try:
                        subject = "Welcome to Skill Bridge Assessment - Yaale Technologies"
                        body = f"""Hello {fullname},

Your account has been created for the Skill Bridge Assessment Platform by Yaale Technologies.

Login Details:
Email: {email.strip().lower()}
Password: {password}

You can log in at: {FRONTEND_URL}/login

Good luck with your assessments!
"""
                        send_notification(email.strip().lower(), subject, body)
                    except Exception as email_err:
                        print(f"ERROR SENDING BULK UPLOAD WELCOME EMAIL TO {email}: {str(email_err)}")
                
        except Exception as e:
            error_msgs.append(f"Row {row_num} (email: {row.get('email', 'unknown')}): {str(e)}")
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database commit failed. All changes rolled back. Error: {str(e)}"
        )
        
    return {
        "message": f"Successfully uploaded {success_count} users",
        "success_count": success_count,
        "errors": error_msgs
    }

@router.get("/attempts", response_model=List[dict])
def list_attempts(
    status: Optional[str] = None, 
    module_id: Optional[str] = None, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_evaluator_user)
):
    query = db.query(TestAttempt).options(joinedload(TestAttempt.user), joinedload(TestAttempt.module)).order_by(TestAttempt.id.desc())
    if status and status.strip():
        query = query.filter(TestAttempt.status == status)
    if module_id and module_id.strip():
        query = query.filter(TestAttempt.module_id == int(module_id))
        
    attempts = query.all()
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "candidate_name": a.user.fullname if a.user else "Unknown User",
            "candidate_email": a.user.email if a.user else "N/A",
            "module_name": a.module.name if a.module else "Unknown Module",
            "status": a.status,
            "total_score": a.total_score,
            "is_passed": a.is_passed,
            "is_published": a.is_published,
            "start_time": a.start_time,
            "end_time": a.end_time
        } for a in attempts
    ]
 
@router.get("/candidate-evaluations")
def list_candidate_evaluations(
    time_range: Optional[str] = None,
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_evaluator_user)
):
    # Group attempts by user to show one row per candidate
    from sqlalchemy import func
    # Show all candidates, even those without any attempts yet
    query = db.query(User).filter(User.role_id == 3)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(or_(User.fullname.ilike(search_term), User.email.ilike(search_term)))
        
    users = query.all()
    
    # Get total modules in the system for accurately showing progress (e.g., X / 6 Modules)
    total_system_modules = db.query(Module).count()
    
    results = []
    for user in users:
        attempts = db.query(TestAttempt).filter(TestAttempt.user_id == user.id).filter(TestAttempt.status != AttemptStatus.IN_PROGRESS).all()
        # Count unique modules that have a completed attempt
        completed_module_ids = {a.module_id for a in attempts if a.status == AttemptStatus.COMPLETED}
        completed_count = len(completed_module_ids)
        
        # Use total_system_modules as the denominator
        total_count = total_system_modules if total_system_modules > 0 else len(attempts)
        is_all_published = all(a.is_published for a in attempts)
        has_completed_unpub = any(a.status == AttemptStatus.COMPLETED and not a.is_published for a in attempts)
        
        # Determine overall display status
        if has_completed_unpub:
            overall_status = "ACTION_REQUIRED"
        elif is_all_published and completed_count == total_count:
            overall_status = "COMPLETED"
        else:
            overall_status = "PARTIAL"
            
        # Find the most recent activity date for this user
        activity_dates = []
        for a in attempts:
            if a.end_time: activity_dates.append(a.end_time)
            elif a.start_time: activity_dates.append(a.start_time)
        
        last_activity = max(activity_dates) if activity_dates else None

        # Filter by time range
        if time_range and time_range != 'all' and last_activity:
            now = datetime.datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            yesterday_start = today_start - datetime.timedelta(days=1)
            week_start = today_start - datetime.timedelta(days=7)
            
            if time_range == 'today' and last_activity < today_start:
                continue
            if time_range == 'yesterday' and (last_activity < yesterday_start or last_activity >= today_start):
                continue
            if time_range == 'week' and last_activity < week_start:
                continue
        elif time_range and time_range != 'all' and not last_activity:
            # If a specific time range is requested but there's no activity, exclude it
            continue

        results.append({
            "user_id": user.id,
            "candidate_name": user.fullname,
            "candidate_email": user.email,
            "assigned_set": user.assigned_set or 'set1',
            "completed_modules": completed_count,
            "total_modules": total_count,
            "status": overall_status,
            "is_published": is_all_published,
            "last_activity": last_activity
        })
    
    # Sort by last_activity descending (most recent first)
    results.sort(key=lambda x: x['last_activity'] or datetime.datetime.min, reverse=True)
    
    if page is not None:
        if page_size is None:
            page_size = 10
        else:
            page_size = max(10, min(30, page_size))
        if page < 1:
            page = 1
        total = len(results)
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        items = results[(page - 1) * page_size : page * page_size]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages
        }
        
    return results

@router.get("/candidate-results/{user_id}")
def get_candidate_results(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_evaluator_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    attempts = db.query(TestAttempt).filter(TestAttempt.user_id == user_id).order_by(TestAttempt.id.desc()).all()
    
    # Group results by module for easy display, keeping the latest attempt
    module_map = {}
    for a in attempts:
        if a.module_id not in module_map:
            module_map[a.module_id] = a

    results = []
    for a in module_map.values():
        results.append({
            "id": a.id,
            "module_id": a.module_id,
            "module_name": a.module.name,
            "status": a.status,
            "score": a.total_score,
            "is_passed": a.is_passed,
            "is_locked": a.is_locked,
            "is_published": a.is_published,
            "end_time": a.end_time
        })
        
    return {

        "user": {"id": user.id, "fullname": user.fullname, "email": user.email},
        "results": results
    }

@router.post("/publish-results/{user_id}")
def publish_results(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_evaluator_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Update all completed or locked attempts to is_published = True
    # Or should it be all attempts? The user said "publish result" for a person.
    # Usually we only publish what's finished.
    attempts = db.query(TestAttempt).filter(TestAttempt.user_id == user_id).all()
    for a in attempts:
        a.is_published = True
    
    db.commit()
    return {"message": f"Successfully published {len(attempts)} results for {user.fullname}"}

@router.get("/attempt/{attempt_id}")
def get_attempt_detail(attempt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_evaluator_user)):
    attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
        
    # Return details including answers
    # Use selectinload for question + options to avoid SQL JOIN row multiplication.
    question_set = attempt.question_set or 'set1'
    questions = db.query(Question).options(selectinload(Question.options)).filter(
        Question.module_id == attempt.module_id,
        func.coalesce(Question.question_set, 'set1') == question_set
    ).order_by(Question.order_index, Question.id).all()
    
    user_answers = db.query(UserAnswer).options(
        joinedload(UserAnswer.selected_option)
    ).filter(UserAnswer.attempt_id == attempt_id).all()
    
    answer_map = {a.question_id: a for a in user_answers}
    
    response_answers = []
    print(f"DEBUG: Processing {len(questions)} questions for attempt {attempt_id}")
    for q in questions:
        if q.question_type == 'QUESTION_FORM':
            continue
            
        a = answer_map.get(q.id)
        
        # Robust retrieval of selected option text
        sel_opt_text = None
        if a:
            if a.selected_option:
                sel_opt_text = a.selected_option.option_text
            elif a.selected_option_id:
                # Fallback in case joinedload failed or was skipped
                opt = db.query(QuestionOption).filter(QuestionOption.id == a.selected_option_id).first()
                if opt:
                    sel_opt_text = opt.option_text
                    print(f"DEBUG: Fallback found text '{sel_opt_text}' for q_id {q.id}")
        
        response_answers.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "question_marks": q.marks,
            "drag_drop_data": q.drag_drop_data,
            "selected_option_id": a.selected_option_id if a else None,
            "selected_option_text": sel_opt_text,
            "correct_option_text": next((o.option_text for o in q.options if o.is_correct), None),
            "text_response": a.text_response if a else None,
            "audio_response": a.audio_response_path if a else None,
            "marks_obtained": a.marks_obtained if a else 0,
            "evaluation_status": a.evaluation_status if a else None
        })
    
    return {
        "id": attempt.id,
        "candidate": attempt.user.fullname,
        "email": attempt.user.email,
        "module": attempt.module.name,
        "status": attempt.status,
        "start_time": attempt.start_time,
        "end_time": attempt.end_time,
        "total_score": attempt.total_score,
        "is_passed": attempt.is_passed,
        "is_locked": attempt.is_locked,
        "proficiency_mapping": attempt.module.proficiency_mapping,
        "answers": response_answers
    }

@router.post("/evaluate/{attempt_id}")
def evaluate_attempt(
    attempt_id: int,
    scores: dict, # question_id: score
    manual_marks: dict = {}, # question_id: "correct"/"wrong"
    comments: Optional[str] = None,
    is_locked: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_evaluator_user)
):
    attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id).first()
    if not attempt:
         raise HTTPException(status_code=404, detail="Attempt not found")
    
    if attempt.is_locked:
        raise HTTPException(status_code=400, detail="Result is locked and cannot be modified")
        
    old_total = attempt.total_score
    total_score = 0
    from datetime import datetime
    
    # We'll use scores sent to determine total_score
    # AND we'll save manual_marks (evaluation_status)
    for q_id_str, score in scores.items():
        try:
            q_id = int(q_id_str)
        except (ValueError, TypeError):
            continue
            
        answer = db.query(UserAnswer).filter(
            UserAnswer.attempt_id == attempt_id,
            UserAnswer.question_id == q_id
        ).first()
        if answer:
            answer.marks_obtained = score
            # Save evaluation status if provided
            status = manual_marks.get(q_id_str)
            if status:
                answer.evaluation_status = status
                answer.evaluated_by = current_user.id
                answer.evaluated_at = datetime.now()
            
            total_score += score
            
    attempt.total_score = total_score
    attempt.evaluator_id = current_user.id
    attempt.evaluator_comments = comments
    attempt.is_locked = is_locked
    
    # Audit log
    db.add(EvaluationLog(
        attempt_id=attempt_id,
        evaluator_id=current_user.id,
        action="Complete Evaluation" if is_locked else "Update Scores",
        old_score=old_total,
        new_score=total_score
    ))
    
    # Check if passed
    question_set = attempt.question_set or 'set1'
    module_questions = db.query(Question).filter(
        Question.module_id == attempt.module_id,
        func.coalesce(Question.question_set, 'set1') == question_set
    ).all()
    total_possible = sum(q.marks for q in module_questions)
    
    # Pass rule: If total score >= module's pass_marks percentage (interpreted here as absolute marks needed for now)
    # Wait, pass_marks is usually an absolute number or percentage. Let's assume it's absolute marks.
    attempt.is_passed = total_score >= attempt.module.pass_marks
    
    db.commit()
    return {"message": "Evaluation successful", "score": total_score, "passed": attempt.is_passed}

@router.get("/questions/excel-template")
def download_excel_template_route(current_user: User = Depends(get_admin_user)):
    """Download a blank Excel template for bulk question upload."""
    import openpyxl
    from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Questions Template"

    headers = [
        "type", "question_text", "marks", "audio_script",
        "recording_duration_sec", "display_type", "option_1", "option_2",
        "option_3", "option_4", "option_5", "option_6", "correct_option"
    ]


    header_fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True, size=11)
    thin = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border

    examples = [
        ["MCQ", "What is the capital of France?", 2, "", "", "click", "Paris", "Berlin", "Madrid", "", "", "", "Paris"],
        ["MCQ", "More and more people go [blank] for their holidays these days.", 5, "", "", "select", "abroad", "away", "home", "stay", "", "", "abroad"],
        ["AUDIO_MCQ", "Listen and choose the correct word.", 3, "The word is 'beautiful'.", "", "click", "beautiful", "wonderful", "terrible", "", "", "", "beautiful"],

        ["WRITING_PROMPT", "Write an email to your manager requesting 2 days leave.", 10, "", "", "", "", "", "", "", "", "", ""],
        ["SPEAKING_PROMPT", "Describe your daily routine in 60 seconds.", 10, "", 60, "", "", "", "", "", "", "", ""],
    ]


    type_colors = {
        "MCQ": "E8F4FD",
        "AUDIO_MCQ": "EAF7EA",
        "WRITING_PROMPT": "FFF8E1",
        "SPEAKING_PROMPT": "FFF0F0",
    }

    for row_idx, row_data in enumerate(examples, 2):
        q_type = row_data[0]
        row_fill = PatternFill(start_color=type_colors.get(q_type, "FFFFFF"), end_color=type_colors.get(q_type, "FFFFFF"), fill_type="solid")
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.fill = row_fill
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = border

    col_widths = [18, 50, 8, 35, 22, 15, 18, 18, 18, 18, 18, 18, 16]

    for i, width in enumerate(col_widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = width

    ws.row_dimensions[1].height = 30

    ws2 = wb.create_sheet("Instructions")
    instructions = [
        ("BULK QUESTION UPLOAD - INSTRUCTIONS", True),
        ("", False),
        ("Column Guide:", True),
        ("type         → MCQ | AUDIO_MCQ | WRITING_PROMPT | SPEAKING_PROMPT", False),
        ("question_text → The full question or prompt text", False),
        ("marks        → Numeric value (e.g., 2, 5, 10)", False),
        ("audio_script  → (Optional) Text version of audio for AUDIO_MCQ", False),
        ("recording_duration_sec → Required for SPEAKING_PROMPT (e.g., 60)", False),
        ("display_type  → click (Radio buttons) | select (Dropdown list) | prompt (Audio Instruction)", False),
        ("option_1 to option_6 → Answer choices (MCQ / AUDIO_MCQ only)", False),
        ("correct_option → Must exactly match one of the options", False),

        ("", False),
        ("NOTES:", True),
        ("- For WRITING_PROMPT and SPEAKING_PROMPT, leave option and correct_option columns empty.", False),
        ("- For AUDIO_MCQ, upload audio files separately via the media upload in the app.", False),
        ("- Use '[blank]' in question_text to place the dropdown in the middle of a sentence (select type only).", False),
        ("- Do not change column header names.", False),
        ("- Leave no blank rows between questions.", False),

    ]
    for r, (text, bold) in enumerate(instructions, 1):
        cell = ws2.cell(row=r, column=1, value=text)
        if bold:
            cell.font = Font(bold=True, size=12 if r == 1 else 10)
    ws2.column_dimensions["A"].width = 80

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=questions_template.xlsx"}
    )


@router.get("/questions/{module_id}", response_model=List[QuestionSchema])
def list_questions(module_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    return db.query(Question).filter(Question.module_id == module_id).order_by(Question.order_index).all()


@router.post("/questions/excel-upload/{module_id}")
def excel_upload_questions(
    module_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Upload an Excel file to bulk create questions for a module."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Read the Excel file
    try:
        content = file.file.read()
        df = pd.read_excel(io.BytesIO(content), sheet_name="Questions Template")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Excel file has no question rows")

    VALID_TYPES = {"MCQ", "AUDIO_MCQ", "WRITING_PROMPT", "SPEAKING_PROMPT", "QUESTION_FORM", "DRAG_DROP_ORDERING", "DRAG_DROP_SLOTS"}
    created_count = 0
    errors = []

    try:
        for idx, row in df.iterrows():
            row_num = idx + 2  # +2 because Excel row 1 is header
            q_type = str(row.get("type", "")).strip().upper()
            q_text = str(row.get("question_text", "")).strip()
            marks_raw = row.get("marks")
            audio_script = str(row.get("audio_script", "")).strip() or None
            rec_dur_raw = row.get("recording_duration_sec")
            display_type = str(row.get("display_type", "click")).strip().lower()
            if not display_type or display_type == "nan":
                display_type = "click"
            
            correct = str(row.get("correct_option", "")).strip()


            # Skip blank rows
            if not q_type or q_type == "NAN" or not q_text or q_text == "NAN":
                continue

            # Validate type
            if q_type not in VALID_TYPES:
                errors.append(f"Row {row_num}: Invalid type '{q_type}'. Must be one of {sorted(VALID_TYPES)}")
                continue

            # Validate marks
            try:
                marks = int(float(marks_raw))
            except (ValueError, TypeError):
                if display_type == "prompt":
                    marks = 0
                else:
                    errors.append(f"Row {row_num}: Invalid marks value '{marks_raw}'")
                    continue

            # Validate options for MCQ types
            options_data = []
            if q_type in ("MCQ", "AUDIO_MCQ") and display_type != "prompt":
                raw_options = []
                # Dynamically check for option_1 to option_10 (or more if exists in sheet)
                for col_name in df.columns:
                    if str(col_name).startswith("option_"):
                        val = str(row.get(col_name, "")).strip()
                        if val and val.lower() != "nan":
                            raw_options.append(val)
                
                if len(raw_options) < 2:

                    errors.append(f"Row {row_num}: MCQ needs at least 2 options")
                    continue
                if not correct or correct.lower() == "nan":
                    errors.append(f"Row {row_num}: MCQ missing correct_option")
                    continue
                found_correct = False
                for opt in raw_options:
                    is_correct = opt.strip().lower() == correct.strip().lower()
                    if is_correct:
                        found_correct = True
                    options_data.append({"option_text": opt, "is_correct": is_correct})
                if not found_correct:
                    errors.append(f"Row {row_num}: correct_option '{correct}' does not match any option")
                    continue

            # Validate recording duration for Speaking
            recording_duration = None
            if q_type == "SPEAKING_PROMPT":
                try:
                    recording_duration = int(float(rec_dur_raw))
                    if recording_duration < 1:
                        raise ValueError()
                except (ValueError, TypeError):
                    errors.append(f"Row {row_num}: SPEAKING_PROMPT requires a valid recording_duration_sec > 0")
                    continue

            # Create question
            question = Question(
                module_id=module_id,
                question_type=q_type,
                question_text=q_text,
                marks=marks,
                audio_script=audio_script,
                recording_duration=recording_duration,
                display_type=display_type,
                order_index=created_count,
                group_id=str(uuid.uuid4())

            )
            db.add(question)
            db.flush()

            for opt in options_data:
                db.add(QuestionOption(
                    question_id=question.id,
                    option_text=opt["option_text"],
                    is_correct=opt["is_correct"]
                ))

            created_count += 1

        if created_count == 0 and errors:
            db.rollback()
            raise HTTPException(status_code=422, detail={"errors": errors})

        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

    return {
        "message": f"Successfully uploaded {created_count} question(s)",
        "created": created_count,
        "errors": errors
    }


@router.post("/questions/bulk")

def bulk_create_questions(
    payload: BulkQuestionsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    module = db.query(Module).filter(Module.id == payload.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    try:
        created = []
        import uuid
        batch_group_id = str(uuid.uuid4())
        
        for idx, q_data in enumerate(payload.questions):
            # Validate MCQ must have options
            if q_data.question_type in (QuestionType.MCQ, QuestionType.AUDIO_MCQ) and q_data.display_type != DisplayType.prompt:
                if not q_data.options or len(q_data.options) == 0:
                    raise HTTPException(status_code=422, detail=f"Question {idx+1}: MCQ type requires answer options")
                if not any(o.is_correct for o in q_data.options):
                    raise HTTPException(status_code=422, detail=f"Question {idx+1}: At least one correct answer must be selected")
            # Validate SPEAKING must have duration
            if q_data.question_type == QuestionType.SPEAKING_PROMPT:
                if not q_data.recording_duration or q_data.recording_duration < 1:
                    raise HTTPException(status_code=422, detail=f"Question {idx+1}: Speaking questions require a recording duration > 0")

            question = Question(
                module_id=payload.module_id,
                question_type=q_data.question_type,
                question_text=q_data.question_text,
                marks=q_data.marks,
                order_index=q_data.order_index if q_data.order_index is not None else idx,
                recording_duration=q_data.recording_duration,
                display_type=q_data.display_type or "click",
                question_set=q_data.question_set or 'set1',
                drag_drop_data=q_data.drag_drop_data,
                audio_script=q_data.audio_script,
                media_url=q_data.media_url,
                group_id=batch_group_id
            )
            db.add(question)
            db.flush()  # get question.id without committing

            if q_data.options:
                for opt in q_data.options:
                    db.add(QuestionOption(
                        question_id=question.id,
                        option_text=opt.option_text,
                        explanation=opt.explanation,
                        is_correct=opt.is_correct
                    ))
            created.append(question.id)

        db.commit()
    except HTTPException as e:
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        import traceback
        with open("error_log.txt", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"System error: {str(e)}")

    return {"message": f"Successfully created {len(created)} questions", "question_ids": created}

@router.post("/question")
def create_question(
    module_id: str = Form(...),
    question_type: str = Form(...),
    question_text: str = Form(...),
    audio_script: Optional[str] = Form(None),
    marks: str = Form(...),
    display_type: str = Form("click"),
    question_set: str = Form("set1"),
    options_json: str = Form(None), 
    drag_drop_data_json: Optional[str] = Form(None),
    recording_duration: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    group_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    print(f"DEBUG: module_id={module_id}, type={question_type}, text={question_text}, marks={marks}, options={options_json}, group_id={group_id}")
    
    # 1. Handle media if any
    media_url = None
    if media_file:
        file_ext = media_file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        save_path = f"uploads/questions/{file_name}"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(media_file.file.read())
        media_url = save_path
        
    # 2. Create core model
    try:
        imodule_id = int(module_id)
        imarks = int(marks)
    except ValueError:
        raise HTTPException(status_code=400, detail="module_id and marks must be integers")
        
    question = Question(
        module_id=imodule_id,
        question_type=question_type,
        question_text=question_text,
        audio_script=audio_script,
        marks=imarks,
        media_url=media_url,
        display_type=display_type,
        question_set=question_set or 'set1',
        recording_duration=int(recording_duration) if recording_duration else None,
        drag_drop_data=json.loads(drag_drop_data_json) if drag_drop_data_json else None,
        group_id=group_id
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    
    # 3. Handle options
    if options_json:
        try:
            options_list = json.loads(options_json)
            # Ensure it's a list
            if isinstance(options_list, list):
                for opt in options_list:
                    q_opt = QuestionOption(
                        question_id=question.id,
                        option_text=opt['option_text'],
                        explanation=opt.get('explanation'),
                        is_correct=opt.get('is_correct', False)
                    )
                    db.add(q_opt)
                db.commit()
                db.refresh(question)
        except Exception as e:
            print(f"Error parsing options: {e}")
            
    return {"id": question.id, "message": "Question created successfully"}

@router.put("/question/{question_id}")
def update_question(
    question_id: int,
    question_type: str = Form(...),
    question_text: str = Form(...),
    audio_script: Optional[str] = Form(None),
    marks: str = Form(...),
    display_type: str = Form("click"),
    question_set: str = Form("set1"),
    options_json: str = Form(None), 
    drag_drop_data_json: Optional[str] = Form(None),
    recording_duration: Optional[str] = Form(None),
    media_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    try:
        imarks = int(marks)
    except ValueError:
        raise HTTPException(status_code=400, detail="marks must be integer")
        
    question.question_type = question_type
    question.question_text = question_text
    question.audio_script = audio_script
    question.marks = imarks
    question.display_type = display_type
    question.question_set = question_set or 'set1'
    if recording_duration is not None:
        try:
            question.recording_duration = int(recording_duration)
        except ValueError:
            pass
    if drag_drop_data_json:
        try:
            question.drag_drop_data = json.loads(drag_drop_data_json)
        except Exception as e:
            print(f"Error parsing drag_drop_data_json: {e}")
    
    if media_file:
        file_ext = media_file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        save_path = f"uploads/questions/{file_name}"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(media_file.file.read())
        question.media_url = save_path
        
    if options_json:
        try:
            options_list = json.loads(options_json)
            if isinstance(options_list, list):
                db.query(QuestionOption).filter(QuestionOption.question_id == question.id).delete()
                for opt in options_list:
                    q_opt = QuestionOption(
                        question_id=question.id,
                        option_text=opt['option_text'],
                        explanation=opt.get('explanation'),
                        is_correct=opt.get('is_correct', False)
                    )
                    db.add(q_opt)
        except Exception as e:
            print(f"Error parsing options: {e}")
            
    db.commit()
    return {"message": "Question updated successfully"}

@router.delete("/question/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # Delete dependent UserAnswers first to avoid foreign key constraints
    db.query(UserAnswer).filter(UserAnswer.question_id == question_id).delete()
    db.query(SpeakingAnswer).filter(SpeakingAnswer.question_id == question_id).delete()
    db.query(SpeakingResult).filter(SpeakingResult.question_id == question_id).delete()
    
    db.query(QuestionOption).filter(QuestionOption.question_id == question_id).delete()
    db.delete(question)
    db.commit()
    return {"message": "Question deleted successfully"}

@router.delete("/questions/group/{group_id}")
def delete_question_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    # Find all questions in the group
    questions = db.query(Question).filter(Question.group_id == group_id).all()
    q_ids = [q.id for q in questions]
    
    if q_ids:
        # Delete dependent entries to avoid foreign key constraints
        db.query(UserAnswer).filter(UserAnswer.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(SpeakingAnswer).filter(SpeakingAnswer.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(SpeakingResult).filter(SpeakingResult.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(QuestionOption).filter(QuestionOption.question_id.in_(q_ids)).delete(synchronize_session=False)
        db.query(Question).filter(Question.id.in_(q_ids)).delete(synchronize_session=False)
        
    db.commit()
    return {"message": "Question group deleted successfully"}

@router.post("/question/{question_id}/media")
async def upload_question_media(
    question_id: int,
    media_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
        
    file_ext = media_file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{file_ext}"
    save_path = f"uploads/questions/{file_name}"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    with open(save_path, "wb") as f:
        f.write(await media_file.read())
        
    question.media_url = save_path
    db.commit()
    return {"message": "Media uploaded successfully", "media_url": save_path}

@router.post("/upload-media")
async def upload_standalone_media(
    media_file: UploadFile = File(...),
    current_user: User = Depends(get_admin_user)
):
    """Generic endpoint for uploading question media files during bulk creation."""
    file_ext = media_file.filename.split(".")[-1].lower() if "." in media_file.filename else "dat"
    file_name = f"q-{uuid.uuid4()}.{file_ext}"
    save_path = f"uploads/questions/{file_name}"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    content = await media_file.read()
    with open(save_path, "wb") as f:
        f.write(content)
        
    return {"media_url": save_path, "filename": media_file.filename}

@router.get("/leaderboard-data")
def get_leaderboard_data(
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    batch: Optional[str] = None,
    module_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    set: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_evaluator_user)
):
    # Get all users who have attempts
    user_ids_with_attempts = db.query(TestAttempt.user_id).distinct().all()
    user_ids = [uid[0] for uid in user_ids_with_attempts]
    
    query = db.query(User).filter(User.id.in_(user_ids))
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(or_(User.fullname.ilike(search_term), User.email.ilike(search_term)))
    if batch and batch != "All Batches":
        try:
            batch_int = int(batch)
            query = query.filter(User.batch == batch_int)
        except ValueError:
            pass
    if set and set != "All Sets":
        query = query.filter(User.assigned_set == set)
            
    users = query.all()
    
    # Get all modules for metadata
    modules = db.query(Module).all()
    module_map = {m.id: {
        "name": m.name, 
        "total_marks": m.total_marks,
        "pass_marks": m.pass_marks,
        "proficiency_mapping": m.proficiency_mapping
    } for m in modules}
    
    leaderboard = []
    for user in users:
        user_attempts_q = db.query(TestAttempt).options(
            joinedload(TestAttempt.answers).joinedload(UserAnswer.question)
        ).filter(TestAttempt.user_id == user.id)
        if set and set != "All Sets":
            user_attempts_q = user_attempts_q.filter((TestAttempt.question_set == set) | (TestAttempt.question_set == None))
        user_attempts = user_attempts_q.all()
        
        module_results_map = {}
        for attempt in user_attempts:
            if attempt.status != AttemptStatus.COMPLETED and not attempt.is_locked:
                continue
            
            # If multiple attempts for same module, keep the most recent (highest ID)
            if attempt.module_id in module_results_map:
                if attempt.id < module_results_map[attempt.module_id]["attempt_id"]:
                    continue
                
            # Get questions for this module filtered by the attempt's assigned question set
            question_set = attempt.question_set or 'set1'
            module_questions = db.query(Question).filter(
                Question.module_id == attempt.module_id,
                func.coalesce(Question.question_set, 'set1') == question_set
            ).order_by(Question.order_index, Question.id).all()
            
            answer_map = {a.question_id: a for a in attempt.answers}
            
            detailed_answers = []
            for q in module_questions:
                if q.question_type == 'QUESTION_FORM':
                    continue
                    
                ans = answer_map.get(q.id)
                detailed_answers.append({
                    "question_id": q.id,
                    "question_text": q.question_text,
                    "evaluation_status": ans.evaluation_status if ans else "wrong", # Show unattempted as wrong
                    "marks_obtained": float(ans.marks_obtained) if ans and ans.marks_obtained else 0,
                    "question_marks": q.marks,
                    "is_attempted": ans is not None
                })
                
            # Calculate real total marks for this module
            actual_total_marks = sum(q.marks for q in module_questions)
            
            module_results_map[attempt.module_id] = {
                "attempt_id": attempt.id,
                "module_id": attempt.module_id,
                "module_name": module_map.get(attempt.module_id, {}).get("name", "Unknown"),
                "total_marks": actual_total_marks,
                "marks_obtained": float(attempt.total_score) if attempt.total_score else 0,
                "proficiency_mapping": module_map.get(attempt.module_id, {}).get("proficiency_mapping"),
                "answers": detailed_answers
            }
        
        module_results = list(module_results_map.values())
            
        if module_results:
            total_marks_obtained = sum(mod["marks_obtained"] for mod in module_results)
            total_marks_possible = sum(mod["total_marks"] for mod in module_results)
            accuracy_perc = int(round((total_marks_obtained / total_marks_possible) * 100)) if total_marks_possible > 0 else 0
            
            for mod in module_results:
                mod["accuracyPerc"] = int(round((mod["marks_obtained"] / mod["total_marks"]) * 100)) if mod["total_marks"] > 0 else 0

            leaderboard.append({
                "user_id": user.id,
                "name": user.fullname,
                "email": user.email,
                "batch": user.batch,
                "modules": module_results,
                "_accuracy_perc": accuracy_perc
            })
            
    if status_filter and status_filter.lower() in ("pass", "fail"):
        filtered = []
        for entry in leaderboard:
            if module_filter and module_filter != 'Overall':
                target_mod = next((m for m in entry["modules"] if m["module_name"] == module_filter), None)
                acc = target_mod["accuracyPerc"] if target_mod else 0
                if status_filter.lower() == "pass" and acc >= 60:
                    filtered.append(entry)
                elif status_filter.lower() == "fail" and acc < 60:
                    filtered.append(entry)
            else:
                # Overall filter checks every individual module in the candidate's modules list
                if not entry["modules"]:
                    # Candidate has no attempts, so they do not pass overall
                    if status_filter.lower() == "fail":
                        filtered.append(entry)
                else:
                    all_modules_pass = all(m["accuracyPerc"] >= 60 for m in entry["modules"])
                    any_module_fails = any(m["accuracyPerc"] < 60 for m in entry["modules"])
                    
                    if status_filter.lower() == "pass" and all_modules_pass:
                        filtered.append(entry)
                    elif status_filter.lower() == "fail" and any_module_fails:
                        filtered.append(entry)
        leaderboard = filtered

    if module_filter and module_filter != 'Overall':
        def get_mod_sort_key(item):
            target_mod = next((m for m in item["modules"] if m["module_name"] == module_filter), None)
            acc = target_mod["accuracyPerc"] if target_mod else 0
            return (acc,)
        leaderboard.sort(key=get_mod_sort_key, reverse=True)
    else:
        leaderboard.sort(key=lambda x: (x["_accuracy_perc"],), reverse=True)
        
    for entry in leaderboard:
        entry.pop("_accuracy_perc", None)

    if page is not None:
        if page_size is None:
            page_size = 10
        else:
            page_size = max(10, min(30, page_size))
        if page < 1:
            page = 1
            
        total = len(leaderboard)
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        items = leaderboard[(page - 1) * page_size : page * page_size]
        
        top_score = 0
        avg_accuracy = 0
        
        if leaderboard:
            if module_filter and module_filter != 'Overall':
                top_score = 0
                accs = []
                for u in leaderboard:
                    m = next((mod for mod in u["modules"] if mod["module_name"] == module_filter), None)
                    if m:
                        top_score = max(top_score, m["accuracyPerc"])
                        accs.append(m["accuracyPerc"])
                    else:
                        accs.append(0)
                avg_accuracy = int(round(sum(accs) / len(accs))) if accs else 0
            else:
                overall_scores = [u.get("_accuracy_perc", 0) for u in leaderboard]
                top_score = max(overall_scores) if overall_scores else 0
                avg_accuracy = int(round(sum(overall_scores) / len(overall_scores))) if leaderboard else 0
        batches_query = db.query(User.batch).filter(User.id.in_(user_ids)).distinct().all()
        all_batches = sorted([b[0] for b in batches_query if b[0] is not None])

        # Get all distinct sets for candidates (include all assigned sets regardless of attempts)
        sets_query = db.query(User.assigned_set).filter(User.role_id == 3).distinct().all()
        all_sets = sorted([s[0] for s in sets_query if s[0] is not None])
        
        # Get all distinct module names
        all_modules = sorted([m.name for m in modules])

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
            "top_score": top_score,
            "avg_accuracy": avg_accuracy,
            "all_batches": all_batches,
            "all_sets": all_sets,
            "all_modules": all_modules
        }
        
    return leaderboard

@router.post("/module-settings/{module_id}")
def update_module_settings(
    module_id: int,
    pass_marks: int = Form(...),
    duration_minutes: int = Form(...),
    total_marks: int = Form(...),
    description: Optional[str] = Form(None),
    proficiency_mapping: Optional[str] = Form(None),
    module_type: Optional[str] = Form(None),
    speaking_recording_duration: Optional[int] = Form(None),
    begin_speaking_audio: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    
    # Handle audio file
    if begin_speaking_audio:
        file_ext = begin_speaking_audio.filename.split(".")[-1]
        file_name = f"mod-{module_id}-begin-{uuid.uuid4()}.{file_ext}"
        save_path = f"uploads/modules/{file_name}"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(begin_speaking_audio.file.read())
        module.begin_speaking_audio_url = save_path

    module.pass_marks = pass_marks
    module.duration_minutes = duration_minutes
    module.total_marks = total_marks
    module.description = description
    if module_type is not None:
        module.module_type = module_type
    if speaking_recording_duration is not None:
        module.speaking_recording_duration = speaking_recording_duration
    if proficiency_mapping is not None:
        try:
            import json
            module.proficiency_mapping = json.loads(proficiency_mapping)
        except Exception as e:
            print(f"Error parsing proficiency_mapping: {e}")
            
    db.commit()
    return {"message": "Module settings updated successfully"}

@router.get("/syllabus")
def list_syllabus(
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_admin_user)
):
    query = db.query(Syllabus)
    if search and search.strip():
        query = query.filter(Syllabus.title.ilike(f"%{search.strip()}%"))
        
    query = query.order_by(Syllabus.id.desc())
    
    if page is not None:
        if page_size is None:
            page_size = 10
        else:
            page_size = max(10, min(30, page_size))
        if page < 1:
            page = 1
        total = query.count()
        pages = (total + page_size - 1) // page_size if total > 0 else 1
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages
        }
        
    return query.all()

@router.post("/syllabus", response_model=SyllabusSchema)
async def upload_syllabus(
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ["pdf", "doc", "docx"]:
         raise HTTPException(status_code=400, detail="Only PDF and Word documents are allowed")
    
    file_name = f"syllabus-{uuid.uuid4()}.{file_ext}"
    save_path = f"uploads/syllabus/{file_name}"
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)
        
    syllabus = Syllabus(
        title=title,
        file_path=save_path,
        file_type=file.content_type
    )
    db.add(syllabus)
    db.commit()
    db.refresh(syllabus)
    return syllabus

@router.put("/syllabus/{syllabus_id}", response_model=SyllabusSchema)
async def update_syllabus(
    syllabus_id: int,
    title: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
        
    syllabus.title = title
    
    if file:
        file_ext = file.filename.split(".")[-1].lower()
        if file_ext not in ["pdf", "doc", "docx"]:
             raise HTTPException(status_code=400, detail="Only PDF and Word documents are allowed")
        
        file_name = f"syllabus-{uuid.uuid4()}.{file_ext}"
        save_path = f"uploads/syllabus/{file_name}"
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
            
        # Optional: Delete old file
        if os.path.exists(syllabus.file_path):
            try:
                os.remove(syllabus.file_path)
            except:
                pass
                
        syllabus.file_path = save_path
        syllabus.file_type = file.content_type
        
    db.commit()
    db.refresh(syllabus)
    return syllabus

@router.delete("/syllabus/{syllabus_id}")
def delete_syllabus(syllabus_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    # Optional: Delete file from disk
    if os.path.exists(syllabus.file_path):
        try:
            os.remove(syllabus.file_path)
        except:
            pass
            
    db.delete(syllabus)
    db.commit()
    return {"message": "Syllabus deleted successfully"}

