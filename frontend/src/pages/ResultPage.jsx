import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import {
    ArrowLeft, HelpCircle
} from 'lucide-react';

const ResultPage = () => {
    const { attemptId } = useParams();
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResult();
    }, [attemptId]);

    const fetchResult = async () => {
        try {
            // Using the new detailed endpoint
            const res = await api.get(`/candidate/my-attempt/${attemptId}`);
            setResult(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="loader-container">
            <div className="premium-loader"></div>
            <p>Processing Your Results...</p>
        </div>
    );

    if (!result) return (
        <div className="error-container glass">
            <HelpCircle size={48} color="#ef4444" />
            <h2>Result Not Found</h2>
            <p>We couldn't retrieve the details for this assessment attempt.</p>
            <button onClick={() => navigate('/')} className="btn-secondary">Return Home</button>
        </div>
    );

    // Find matched proficiency level
    let matchedLevel = 'N/A';
    if (result && result.proficiency_mapping && Array.isArray(result.proficiency_mapping)) {
        const score = parseFloat(result.total_score || 0);
        for (const rule of result.proficiency_mapping) {
            const min = parseFloat(rule.min);
            const max = parseFloat(rule.max);
            if (!isNaN(min) && !isNaN(max) && score >= min && score <= max) {
                matchedLevel = rule.level;
                break;
            }
        }
    }

    return (
        <div className="result-v2 light-theme">
            <header className="v2-header">
                <button onClick={() => navigate('/')} className="back-link">
                    <ArrowLeft size={18} /> Exit Report
                </button>
                <div className="module-title-box">
                    <span className="mod-label">Assessment Report</span>
                    <h2 className="mod-name">{result.module_name}</h2>
                </div>
                <div style={{ width: '100px' }}></div>
            </header>

            <main className="v2-content">
                <div className="bc-result-card animate-slide-up">
                    <div className="bc-table-wrapper">
                        <table className="bc-table">
                            <thead>
                                <tr>
                                    <th>Skill name</th>
                                    <th>Skill score</th>
                                    <th>Level</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="skill-name-cell">{result.module_name}</td>
                                    <td className="skill-score-cell">{parseFloat(result.total_score || 0)}/{parseFloat(result.total_possible || 0)}</td>
                                    <td>
                                        <div className="level-wrapper">
                                            <span className="skill-level-cell">
                                                {matchedLevel}
                                            </span>
                                        </div>
                                    </td>                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <style>{`
.result-v2.light-theme{
    min-height:100vh;
    background:#eef4ff;
    font-family:'Outfit',sans-serif;
    color:#0f172a;
}

/* HEADER */

.v2-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:22px 40px;
    background:linear-gradient(135deg,#007373 0%,#005959 100%);
    color:white;
    box-shadow:0 10px 35px rgba(0, 115, 115,.22);
    position:sticky;
    top:0;
    z-index:100;
}

.back-link{
    background:rgba(255,255,255,.12);
    border:none;
    color:white;
    padding:10px 18px;
    border-radius:12px;
    display:flex;
    align-items:center;
    gap:8px;
    cursor:pointer;
    font-weight:600;
    transition:.25s;
}

.back-link:hover{
    background:rgba(255,255,255,.22);
    transform:translateY(-2px);
}

.module-title-box{
    text-align:center;
}

.mod-label{
    font-size:12px;
    text-transform:uppercase;
    letter-spacing:3px;
    opacity:.85;
    font-weight:700;
}

.mod-name{
    margin-top:6px;
    font-size:28px;
    font-weight:900;
    color:white;
}

/* CONTENT */

.v2-content{
    max-width:900px;
    margin:70px auto;
    padding:0 20px;
}

/* CARD */

.bc-result-card{
    background:white;
    border-radius:24px;
    overflow:hidden;
    box-shadow:
        0 20px 60px rgba(15,23,42,.10),
        0 8px 25px rgba(0, 115, 115,.08);
    border:1px solid rgba(0, 115, 115,.08);
}

/* TOP BAR */

.bc-result-card::before{
    content:'';
    display:block;
    height:8px;
    background:linear-gradient(135deg,#007373 0%,#005959 100%);
}

/* TABLE */
.bc-table{
    width:100%;
    border-collapse:collapse;
    table-layout:fixed;
}

.bc-table thead tr{
    background:#f1f7ff;
}

.bc-table th{
    padding:20px 28px;
    font-size:15px;
    font-weight:800;
    color:#076433;
    text-transform:uppercase;
    letter-spacing:1px;
    border-bottom:2px solid #d4f3df;
    text-align:center;
}

.bc-table th:first-child{
    text-align:left;
    padding-left:40px;
}

.bc-table td{
    padding:24px 28px;
    border-bottom:1px solid #edf2f7;
    font-size:17px;
    vertical-align:middle;
    text-align:center;
}

.bc-table td:first-child{
    text-align:left;
    padding-left:40px;
}

.bc-table tbody tr{
    transition:all .25s ease;
}

.bc-table tbody tr:hover{
    background:#f8fbff;
}

.bc-table tbody tr:last-child td{
    border-bottom:none;
}

.skill-name-cell{
    font-size:18px;
    font-weight:700;
    color:#172033;
}

.skill-score-cell{
    font-size:18px;
    font-weight:800;
    color:#007373;
}

.level-wrapper{
    display:flex;
    justify-content:center;
    align-items:center;
}

.skill-level-cell{
    display:inline-flex;
    justify-content:center;
    align-items:center;
    min-width:84px;
    height:44px;
    padding:0 18px;
    background:linear-gradient(135deg,#007373 0%,#005959 100%);
    color:#fff;
    border-radius:999px;
    font-size:18px;
    font-weight:800;
    box-shadow:0 6px 16px rgba(0, 115, 115,.22);
}

/* ANIMATION */

.animate-slide-up{
    animation:slideUp .7s cubic-bezier(.16,1,.3,1) both;
}

@keyframes slideUp{
    from{
        opacity:0;
        transform:translateY(35px);
    }
    to{
        opacity:1;
        transform:translateY(0);
    }
}

/* LOADER */

.loader-container,
.error-container{
    min-height:100vh;
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
}

.premium-loader{
    width:70px;
    height:70px;
    border:5px solid #d4f3df;
    border-top:5px solid #007373;
    border-radius:50%;
    animation:spin 1s linear infinite;
    margin-bottom:24px;
}

@keyframes spin{
    to{
        transform:rotate(360deg);
    }
}

/* BUTTON */

.btn-secondary{
    margin-top:24px;
    padding:14px 30px;
    border:none;
    border-radius:14px;
    background:linear-gradient(135deg,#007373 0%,#005959 100%);
    color:white;
    font-weight:700;
    cursor:pointer;
    transition:.25s;
}

.btn-secondary:hover{
    transform:translateY(-2px);
    box-shadow:0 10px 25px rgba(0, 115, 115,.22);
}

/* MOBILE */

@media(max-width:768px){

    .v2-header{
        padding:18px;
    }

    .mod-name{
        font-size:20px;
    }

    .bc-table th,
    .bc-table td{
        padding:16px;
        font-size:14px;
    }

    .skill-score-cell{
        font-size:16px;
    }
}
`}</style>
        </div>
    );
};

export default ResultPage;
