from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
from decimal import Decimal
from .models import RoleNames, QuestionType, AttemptStatus, DisplayType

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    email: str
    fullname: Optional[str] = None
    batch: Optional[int] = None
    education: Optional[str] = None
    assigned_set: Optional[str] = 'set1'

class UserCreate(UserBase):
    password: str
    role_id: Optional[int] = 3 # Default to Candidate

class UserUpdate(BaseModel):
    fullname: Optional[str] = None
    email: Optional[EmailStr] = None
    role_id: Optional[int] = None
    batch: Optional[int] = None
    education: Optional[str] = None
    assigned_set: Optional[str] = None
    password: Optional[str] = None
    reset_progress: Optional[bool] = False

class Role(BaseModel):
    id: int
    name: Optional[str] = None
    class Config:
        from_attributes = True

class User(UserBase):
    id: int
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    batch: Optional[int] = None
    created_at: Optional[datetime] = None
    role: Optional[Role] = None
    class Config:
        from_attributes = True

class PaginatedUsers(BaseModel):
    items: List[User]
    total: int
    page: int
    page_size: int
    pages: int
    total_users: int
    candidates_count: int
    evaluators_count: int
    class Config:
        from_attributes = True

class ModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int
    pass_marks: int
    total_marks: int
    proficiency_mapping: Optional[List[dict]] = None
    module_type: Optional[str] = None
    begin_speaking_audio_url: Optional[str] = None
    speaking_recording_duration: Optional[int] = None
    question_count: Optional[int] = 0

class Module(ModuleBase):
    id: int
    class Config:
        from_attributes = True

class QuestionOptionBase(BaseModel):
    option_text: str
    explanation: Optional[str] = None
    is_correct: bool

class QuestionOption(QuestionOptionBase):
    id: int
    class Config:
        from_attributes = True

class QuestionBase(BaseModel):
    module_id: int
    question_type: QuestionType
    question_text: str
    audio_script: Optional[str] = None
    media_url: Optional[str] = None
    marks: int
    order_index: Optional[int] = 0
    recording_duration: Optional[int] = None
    display_type: Optional[DisplayType] = DisplayType.click
    question_set: Optional[str] = 'set1'
    drag_drop_data: Optional[dict] = None
    group_id: Optional[str] = None

class QuestionCreate(QuestionBase):
    pass

class BulkQuestionOption(BaseModel):
    option_text: str
    explanation: Optional[str] = None
    is_correct: bool = False

class BulkQuestionItem(BaseModel):
    question_type: QuestionType
    question_text: str
    marks: int = 10
    order_index: int = 0
    recording_duration: Optional[int] = None
    display_type: Optional[DisplayType] = DisplayType.click
    question_set: Optional[str] = 'set1'
    audio_script: Optional[str] = None
    media_url: Optional[str] = None
    drag_drop_data: Optional[dict] = None
    options: Optional[List[BulkQuestionOption]] = None  # MCQ/AUDIO_MCQ

class BulkQuestionsCreate(BaseModel):
    module_id: int
    questions: List[BulkQuestionItem]

class Question(QuestionBase):
    id: int
    options: List[QuestionOption] = []
    drag_drop_data: Optional[dict] = None
    class Config:
        from_attributes = True

class UserAnswer(BaseModel):
    id: Optional[int] = None
    question_id: int
    marks_obtained: Optional[Decimal] = None
    evaluation_status: Optional[str] = None
    time_taken: Optional[int] = None
    text_response: Optional[str] = None
    audio_response_path: Optional[str] = None
    class Config:
        from_attributes = True

class TestAttemptBase(BaseModel):
    module_id: int
    question_set: Optional[str] = 'set1'

class TestAttemptUpdate(BaseModel):
    status: AttemptStatus
    end_time: Optional[datetime] = None
    total_score: Optional[Decimal] = None
    is_passed: Optional[bool] = None

class TestAttempt(TestAttemptBase):
    id: int
    user_id: int
    question_set: str
    status: AttemptStatus
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    total_score: Optional[Decimal]
    is_passed: bool
    is_published: bool = False
    answers: List[UserAnswer] = []
    
    # Extra fields for UI convenience
    module_name: Optional[str] = None
    total_possible: Optional[int] = None
    
    class Config:
        from_attributes = True

class SyllabusBase(BaseModel):
    title: str

class Syllabus(SyllabusBase):
    id: int
    file_path: str
    file_type: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True
