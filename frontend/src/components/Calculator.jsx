import React, { useState } from 'react';
import { X } from 'lucide-react';

const Calculator = ({ onClose }) => {
  const [expression, setExpression] = useState('0');
  const [result, setResult] = useState('');
  const [history, setHistory] = useState([]);
  const [shouldReset, setShouldReset] = useState(false);

  const handleInput = (value) => {
    if (expression === '0' || shouldReset) {
      if (['+', '×', '÷', '-', '%', ')'].includes(value)) {
        setExpression('0' + value);
      } else {
        setExpression(value);
      }
      setShouldReset(false);
    } else {
      setExpression(prev => prev + value);
    }
  };

  const handleClear = () => {
    setExpression('0');
    setResult('');
    setShouldReset(false);
  };

  const handleCalculate = () => {
    if (!expression || expression === '0') return;
    try {
      // 1. Pre-process for implicit multiplication: 3(4) -> 3*(4)
      let processedExpr = expression
        .replace(/(\d)\(/g, '$1*(')
        .replace(/\)(\d)/g, ')*$1')
        .replace(/\)\(/g, ')*(')
        .replace(/×/g, '*')
        .replace(/÷/g, '/');

      // 2. Handle percentage: 10% -> (10/100)
      processedExpr = processedExpr.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

      // 3. Evaluate
      // eslint-disable-next-line no-eval
      const calculatedValue = eval(processedExpr);
      
      if (isNaN(calculatedValue) || !isFinite(calculatedValue)) {
        throw new Error('Invalid Result');
      }

      const formattedResult = String(Number(calculatedValue.toFixed(8)));
      
      setResult(expression + ' =');
      
      // Add to history
      setHistory(prev => [{ equation: expression, result: formattedResult }, ...prev].slice(0, 10));
      
      setExpression(formattedResult);
      setShouldReset(true);
    } catch (e) {
      setExpression('Error');
      setShouldReset(true);
    }
  };

  const buttons = [
    { label: '(', action: () => handleInput('('), type: 'symbol' },
    { label: ')', action: () => handleInput(')'), type: 'symbol' },
    { label: '%', action: () => handleInput('%'), type: 'symbol' },
    { label: 'C', action: handleClear, type: 'clear' },
    
    { label: '7', action: () => handleInput('7') },
    { label: '8', action: () => handleInput('8') },
    { label: '9', action: () => handleInput('9') },
    { label: '÷', action: () => handleInput('÷'), type: 'operator' },
    
    { label: '4', action: () => handleInput('4') },
    { label: '5', action: () => handleInput('5') },
    { label: '6', action: () => handleInput('6') },
    { label: '×', action: () => handleInput('×'), type: 'operator' },
    
    { label: '1', action: () => handleInput('1') },
    { label: '2', action: () => handleInput('2') },
    { label: '3', action: () => handleInput('3') },
    { label: '-', action: () => handleInput('-'), type: 'operator' },
    
    { label: '0', action: () => handleInput('0') },
    { label: '.', action: () => handleInput('.') },
    { label: 'DEL', action: () => setExpression(expression.length > 1 ? expression.slice(0, -1) : '0'), type: 'delete' },
    { label: '+', action: () => handleInput('+'), type: 'operator' },
    
    { label: '=', action: handleCalculate, type: 'equal', double: true },
  ];

  return (
    <div className="calculator-overlay">
      <div className="calculator-main-container">
        <div className="calculator-body">
          <div className="calc-header">
            <span>Scientific Calculator</span>
            <button onClick={onClose} className="calc-close"><X size={18} /></button>
          </div>
          
          <div className="calc-display">
            <div className="calc-equation">{result}</div>
            <div className="calc-current">{expression}</div>
          </div>

          <div className="calc-grid">
            {buttons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                className={`calc-btn ${btn.type || ''} ${btn.double ? 'double-w' : ''}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div className="calc-history">
            <div className="history-header">History</div>
            <div className="history-list">
              {history.map((item, i) => (
                <div key={i} className="history-item" onClick={() => { setExpression(item.result); setShouldReset(true); }}>
                  <div className="h-eq">{item.equation}</div>
                  <div className="h-res">= {item.result}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .calculator-overlay {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 9999;
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .calculator-main-container {
          display: flex;
          background: #1e293b;
          border-radius: 20px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255,255,255,0.1);
          overflow: hidden;
          height: 480px;
        }
        .calculator-body {
          width: 300px;
          padding: 20px;
          border-right: 1px solid rgba(255,255,255,0.05);
          display: flex;
          flex-direction: column;
        }
        .calc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #94a3b8;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .calc-close {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .calc-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
        
        .calc-display {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 16px;
          text-align: right;
          min-height: 80px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          border: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }
        .calc-equation { color: #64748b; font-size: 12px; min-height: 16px; margin-bottom: 2px; }
        .calc-current { 
          color: #fff; 
          font-size: 24px; 
          font-weight: 600; 
          word-break: break-all; 
          overflow-y: auto; 
          max-height: 60px;
          padding-right: 4px;
        }
        .calc-current::-webkit-scrollbar { width: 4px; }
        .calc-current::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        .calc-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          flex: 1;
        }
        .calc-btn {
          height: 100%;
          border-radius: 10px;
          border: none;
          background: #334155;
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .calc-btn:hover { background: #475569; transform: translateY(-1px); }
        .calc-btn:active { transform: translateY(1px); }
        
        .calc-btn.operator { background: #11b85c; }
        .calc-btn.symbol { background: #475569; color: #fbbf24; }
        .calc-btn.equal { background: #10b981; }
        .calc-btn.clear { background: #ef4444; }
        .calc-btn.delete { background: #4b5563; font-size: 11px; }
        .calc-btn.double-w { grid-column: span 4; height: 44px; margin-top: 4px; }
        
        .calc-history {
          width: 180px;
          background: rgba(15, 23, 42, 0.3);
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .history-header { color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.1em; flex-shrink: 0; }
        .history-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex: 1; padding-right: 4px; }
        .history-item { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: #94a3b8; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: right; }
        .history-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .h-eq { opacity: 0.6; font-size: 10px; word-break: break-all; }
        .h-res { font-weight: 700; color: #10b981; font-size: 12px; }
        
        .history-list::-webkit-scrollbar { width: 4px; }
        .history-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Calculator;
