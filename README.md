# WPLN Online Assessment Platform (Clone)

A secure, scalable web application built with **FastAPI**, **React**, and **MySQL** for workforce literacy and numeracy assessments.

---

## 🛠 Features

### 👤 Candidate View
- **Authentication**: Secure JWT Login & Profile Management.
- **Dashboard**: 6 Assessment Modules:
  - Speaking (Audio Recording)
  - Listening (Audio MCQs)
  - Writing (Text Input)
  - Reading (Passage MCQs)
  - Grammar & Vocabulary (MCQs)
  - Numeracy (MCQs)
- **Test Integrity**:
  - Auto-timer (MM:SS) with 2-minute warning.
  - Anti-cheat logic: Copy/Paste disabled, Tab switching detection.
  - Auto-submission on timer expiry.

### 🛠 Admin Panel
- **User Management**: Add/Edit/Search users & Roles (Admin, Evaluator, Candidate).
- **Bulk Upload**: Import users from CSV/Excel.
- **Question Management**: Create questions with media uploads and MCQ options.
- **Evaluation**: Manual scoring for Writing and Speaking with draft/lock support.
- **Certification**: Automated PDF certificate generation for passed candidates.

---

## 🏗 Technology Stack
*   **Backend**: Python (FastAPI)
*   **Frontend**: React (Vite) + Lucide Icons + Framer Motion
*   **Database**: MySQL (Local)
*   **Storage**: Local file storage for audio and certificates.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9+
- Node.js 18+
- MySQL Server (Running)

### 2. Installation & Setup
1.  **Clone the project** to your local directory.
2.  **Create the Database**:
    ```sql
    CREATE DATABASE wpln_assessment;
    ```
3.  **Install dependencies**:
    ```bash
    python setup_dev.py
    ```

### 3. Running the Application
- **Start Backend**:
  ```bash
  cd backend
  python -m uvicorn app.main:app --reload
  ```
- **Start Frontend**:
  ```bash
  cd frontend
  npm run dev
  ```

---

## 🔐 Security Notes
- Password hashing using `bcrypt`.
- JWT Token expiration set to 30 mins.
- Role-Based Access Control (RBAC) enforced on all API routes.
- Anti-cheat detects and logs tab visibility changes.
