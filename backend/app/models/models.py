from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, Text, DateTime, DECIMAL, TIMESTAMP, func, JSON
from sqlalchemy.orm import relationship
from ..database import Base
import enum

class RoleNames(str, enum.Enum):
    ADMIN = "ADMIN"
    EVALUATOR = "EVALUATOR"
    CANDIDATE = "CANDIDATE"

class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    AUDIO_MCQ = "AUDIO_MCQ"
    WRITING_PROMPT = "WRITING_PROMPT"
    SPEAKING_PROMPT = "SPEAKING_PROMPT"
    DRAG_DROP_ORDERING = "DRAG_DROP_ORDERING"
    DRAG_DROP_SLOTS = "DRAG_DROP_SLOTS"
    QUESTION_FORM = "QUESTION_FORM"

class AttemptStatus(str, enum.Enum):
    NOT_ATTEMPTED = "NOT_ATTEMPTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class DisplayType(str, enum.Enum):
    click = "click"
    select = "select"
    writing = "writing"
    prompt = "prompt"

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    fullname = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"))
    is_active = Column(Boolean, default=True)
    batch = Column(Integer, nullable=True)
    education = Column(String(100), nullable=True)
    assigned_set = Column(String(20), nullable=False, default='set1')
    created_at = Column(DateTime, server_default=func.now())
    role = relationship("Role", back_populates="users")
    attempts = relationship("TestAttempt", back_populates="user", foreign_keys="TestAttempt.user_id")

class Module(Base):
    __tablename__ = "modules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    duration_minutes = Column(Integer, default=30)
    pass_marks = Column(Integer, default=50)
    total_marks = Column(Integer, default=100)
    proficiency_mapping = Column(JSON, nullable=True)
    module_type = Column(String(50), nullable=True) # e.g. 'listening', 'speaking', 'writing', 'reading'
    begin_speaking_audio_url = Column(String(255), nullable=True)
    speaking_recording_duration = Column(Integer, nullable=True)
    questions = relationship("Question", back_populates="module")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"))
    question_type = Column(Enum(QuestionType), nullable=False)
    question_text = Column(Text)
    audio_script = Column(Text, nullable=True)
    media_url = Column(String(255))
    marks = Column(Integer, default=1)
    order_index = Column(Integer, default=0)
    recording_duration = Column(Integer, nullable=True)  # seconds, for SPEAKING_PROMPT
    display_type = Column(Enum(DisplayType), default=DisplayType.click, nullable=False)
    question_set = Column(String(20), nullable=False, default='set1')
    drag_drop_data = Column(JSON, nullable=True)
    group_id = Column(String(100), nullable=True, index=True)
    module = relationship("Module", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")

class QuestionOption(Base):
    __tablename__ = "question_options"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    option_text = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    question = relationship("Question", back_populates="options")

class TestAttempt(Base):
    __tablename__ = "test_attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    module_id = Column(Integer, ForeignKey("modules.id"))
    question_set = Column(String(20), nullable=False, default='set1')
    status = Column(Enum(AttemptStatus), default=AttemptStatus.NOT_ATTEMPTED)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    total_score = Column(DECIMAL(5, 2), nullable=True)
    is_passed = Column(Boolean, default=False)
    evaluator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    evaluator_comments = Column(Text, nullable=True)
    is_locked = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    user = relationship("User", back_populates="attempts", foreign_keys=[user_id])
    evaluator = relationship("User", foreign_keys=[evaluator_id])
    module = relationship("Module")
    answers = relationship("UserAnswer", back_populates="attempt")

class EvaluationLog(Base):
    __tablename__ = "evaluation_logs"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("test_attempts.id"))
    evaluator_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(255)) # e.g., "Score Override", "Manual Evaluation"
    old_score = Column(DECIMAL(5, 2), nullable=True)
    new_score = Column(DECIMAL(5, 2))
    timestamp = Column(DateTime, server_default=func.now())
    
    attempt = relationship("TestAttempt")
    evaluator = relationship("User")

class UserAnswer(Base):
    __tablename__ = "user_answers"
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("test_attempts.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    selected_option_id = Column(Integer, ForeignKey("question_options.id"), nullable=True)
    text_response = Column(Text, nullable=True)
    audio_response_path = Column(String(255), nullable=True)
    time_taken = Column(Integer, nullable=True) # Seconds taken
    marks_obtained = Column(DECIMAL(5, 2), nullable=True)
    evaluation_status = Column(String(50), nullable=True) # "correct", "wrong"
    evaluated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    evaluated_at = Column(DateTime, nullable=True)
    
    attempt = relationship("TestAttempt", back_populates="answers")
    question = relationship("Question")
    selected_option = relationship("QuestionOption", foreign_keys=[selected_option_id])
    evaluator = relationship("User", foreign_keys=[evaluated_by])

class Syllabus(Base):
    __tablename__ = "syllabus"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class SpeakingAnswer(Base):
    """Stores the transcribed text for each speaking question answer."""
    __tablename__ = "speaking_answers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_id = Column(Integer, ForeignKey("test_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    transcribed_text = Column(Text, nullable=True)
    audio_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    attempt = relationship("TestAttempt", foreign_keys=[test_id])
    question = relationship("Question", foreign_keys=[question_id])


class SpeakingResult(Base):
    """Stores per-question speaking scores and total score for an attempt."""
    __tablename__ = "speaking_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    test_id = Column(Integer, ForeignKey("test_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    obtained_marks = Column(DECIMAL(5, 2), nullable=True)
    max_marks = Column(Integer, nullable=False)
    total_score = Column(DECIMAL(5, 2), nullable=True)  # filled only on last row or redundant
    raw_response = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    attempt = relationship("TestAttempt", foreign_keys=[test_id])
    question = relationship("Question", foreign_keys=[question_id])
