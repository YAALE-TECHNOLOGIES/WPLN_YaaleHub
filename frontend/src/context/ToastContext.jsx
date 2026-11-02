import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        if (duration !== Infinity) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast-item ${toast.type} fade-in-right`}>
                        <div className="toast-icon">
                            {toast.type === 'success' && <CheckCircle size={20} />}
                            {toast.type === 'error' && <XCircle size={20} />}
                            {toast.type === 'warning' && <AlertCircle size={20} />}
                            {toast.type === 'info' && <Info size={20} />}
                        </div>
                        <div className="toast-content">{toast.message}</div>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                .toast-container {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }

                .toast-item {
                    pointer-events: auto;
                    min-width: 320px;
                    max-width: 450px;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 12px;
                    padding: 16px;
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    animation: slideIn 0.3s ease-out forwards;
                }

                .toast-icon {
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .toast-content {
                    flex: 1;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                    line-height: 1.5;
                }

                .toast-close {
                    flex-shrink: 0;
                    padding: 4px;
                    border-radius: 6px;
                    color: #94a3b8;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .toast-close:hover {
                    background: rgba(0, 0, 0, 0.05);
                    color: #1e293b;
                }

                /* Type Styles */
                .toast-item.success { border-left: 4px solid #10b981; }
                .toast-item.success .toast-icon { color: #10b981; }
                
                .toast-item.error { border-left: 4px solid #ef4444; }
                .toast-item.error .toast-icon { color: #ef4444; }
                
                .toast-item.warning { border-left: 4px solid #f59e0b; }
                .toast-item.warning .toast-icon { color: #f59e0b; }
                
                .toast-item.info { border-left: 4px solid #007373; }
                .toast-item.info .toast-icon { color: #007373; }

                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                @keyframes fadeOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `}</style>
        </ToastContext.Provider>
    );
};
