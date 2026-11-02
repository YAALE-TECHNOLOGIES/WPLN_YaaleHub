from app.database import SessionLocal
from app.models.models import Question, QuestionType
import json

db = SessionLocal()
try:
    q = Question(
        module_id=1,
        question_type=QuestionType.DRAG_DROP,
        question_text="Test",
        marks=10,
        order_index=0,
        display_type="click",
        drag_drop_data={"drag_items": ["A"], "drop_zones": ["B"], "correct_mapping": {"0": 0}}
    )
    db.add(q)
    db.commit()
    print("Success! Created question ID:", q.id)
except Exception as e:
    print("Error:", str(e))
finally:
    db.close()
