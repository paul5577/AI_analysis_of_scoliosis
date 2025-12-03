
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from '@google/genai';

declare global {
    interface Window {
        emailjs: any;
    }
}

// --- Types ---
interface AnalysisResult {
    cobbAngle: number;
    classification: string;
    date?: string; // For history
}

interface HistoryItem extends AnalysisResult {
    timestamp: number;
}

// --- Helper Functions ---

// Helper to check environment variables explicitly to support Vite static replacement
const getEnvConfig = () => {
    let apiKey = '';
    let emailJsPublicKey = '';
    let emailJsServiceId = '';
    let emailJsTemplateId = '';

    // 1. Try Vite (VITE_ prefix) - Explicit access required for Vite static replacement
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
            // @ts-ignore
            if (import.meta.env.VITE_API_KEY) apiKey = import.meta.env.VITE_API_KEY;
            // @ts-ignore
            if (import.meta.env.VITE_EMAILJS_PUBLIC_KEY) emailJsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
            // @ts-ignore
            if (import.meta.env.VITE_EMAILJS_SERVICE_ID) emailJsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
            // @ts-ignore
            if (import.meta.env.VITE_EMAILJS_TEMPLATE_ID) emailJsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
        }
    } catch (e) {}

    // 2. Fallback to process.env for CRA/Next.js/Standard Node (if Vite didn't fill it)
    if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.REACT_APP_API_KEY || process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY || '';
    }
    if (!emailJsPublicKey && typeof process !== 'undefined' && process.env) {
        emailJsPublicKey = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || process.env.EMAILJS_PUBLIC_KEY || '';
    }
    if (!emailJsServiceId && typeof process !== 'undefined' && process.env) {
        emailJsServiceId = process.env.REACT_APP_EMAILJS_SERVICE_ID || process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || process.env.EMAILJS_SERVICE_ID || '';
    }
    if (!emailJsTemplateId && typeof process !== 'undefined' && process.env) {
        emailJsTemplateId = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID || '';
    }

    return {
        apiKey,
        emailJs: {
            publicKey: emailJsPublicKey,
            serviceId: emailJsServiceId,
            templateId: emailJsTemplateId
        }
    };
};

// Image compression utility
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;

                // Resize logic
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl.split(',')[1]);
                } else {
                    reject(new Error("Canvas context is null"));
                }
            };
            img.onerror = (err) => reject(new Error("Image load failed"));
        };
        reader.onerror = (err) => reject(new Error("File read failed"));
    });
};

// --- Components ---

const ConsultationModal: React.FC<{ onClose: () => void; onSubmit: (data: any) => Promise<void>; isSending: boolean; formMessage: { type: string, text: string } | null }> = ({ onClose, onSubmit, isSending, formMessage }) => {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        gender: 'male',
        phone: '',
        email: '',
        message: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>무료 상담 신청</h2>
                    <button onClick={onClose} className="modal-close-btn" aria-label="Close">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="consultation-form">
                    <div className="form-group">
                        <label htmlFor="name">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="age">나이</label>
                        <input type="number" id="age" name="age" value={formData.age} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="gender">성별</label>
                        <select id="gender" name="gender" value={formData.gender} onChange={handleChange} required>
                            <option value="male">남성</option>
                            <option value="female">여성</option>
                            <option value="other">기타</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">전화번호</label>
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">이메일</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="message">상담내용</label>
                        <textarea id="message" name="message" value={formData.message} onChange={handleChange} required />
                    </div>
                    <div className="button-group">
                        <button type="submit" className="btn" disabled={isSending}>
                            {isSending ? '전송 중...' : '상담 신청하기'}
                        </button>
                    </div>
                    {formMessage && (
                        <p className={`form-message ${formMessage.type}`}>
                            {formMessage.text}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

const SettingsModal: React.FC<{ onClose: () => void; currentKey: string; onSave: (key: string) => void; envKeyDetected: boolean }> = ({ onClose, currentKey, onSave, envKeyDetected }) => {
    const [key, setKey] = useState(currentKey);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>설정</h2>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                
                <div style={{marginBottom: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6'}}>
                    <p style={{marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold'}}>배포 환경 변수(Vercel) 상태:</p>
                    {envKeyDetected ? (
                        <div style={{color: 'green', display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <span>✅</span> 연결됨 (API Key가 감지되었습니다)
                        </div>
                    ) : (
                        <div style={{color: '#dc3545', display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <span>❌</span> 감지되지 않음
                        </div>
                    )}
                    <p style={{fontSize: '0.8rem', color: '#666', marginTop: '5px'}}>
                        사용량이 많아 분석이 지연되거나(429 오류), 배포 환경 문제 시 본인의 API Key를 입력하면 제한 없이 사용할 수 있습니다.
                    </p>
                </div>

                <div className="form-group">
                    <label htmlFor="apiKey">Gemini API Key 직접 입력</label>
                    <input 
                        type="password" 
                        id="apiKey" 
                        value={key} 
                        onChange={(e) => setKey(e.target.value)} 
                        placeholder="AIza..."
                        style={{background:'#fff', color:'#000'}}
                    />
                    <small style={{display:'block', marginTop:'5px', color:'#666'}}>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">키 발급받기 (Google AI Studio)</a>
                    </small>
                </div>
                <div className="button-group">
                    <button className="btn" onClick={() => onSave(key)}>저장하기</button>
                </div>
            </div>
        </div>
    );
};

const HistoryModal: React.FC<{ onClose: () => void; history: HistoryItem[] }> = ({ onClose, history }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>분석 기록</h2>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="history-list">
                    {history.length === 0 ? (
                        <p style={{textAlign:'center', padding:'20px', color:'#999'}}>저장된 기록이 없습니다.</p>
                    ) : (
                        history.map((item, index) => (
                            <div key={index} className="history-item">
                                <div className="history-date">{item.date}</div>
                                <div className="history-result">
                                    <span className={`badge ${item.classification.toLowerCase()}`}>
                                        {item.classification === 'Normal' ? '정상' : item.classification === 'Mild' ? '경미' : '위험'}
                                    </span>
                                    <strong>{item.cobbAngle > -1 ? `${item.cobbAngle}°` : '--'}</strong>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const Features = () => (
    <section className="features-section">
        <h2>앱의 주요 특징</h2>
        <div className="features-grid">
            <div className="feature-card">
                <div className="feature-icon">🔍</div>
                <h3>AI 정밀 분석</h3>
                <p>Gemini AI가 척추의 콥스 각도를 정밀하게 측정하고 분석합니다.</p>
            </div>
            <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>초간편 사용</h3>
                <p>회원가입 없이 사진 한 장만 업로드하면 즉시 결과를 볼 수 있습니다.</p>
            </div>
            <div className="feature-card">
                <div className="feature-icon">🛡️</div>
                <h3>안전한 보안</h3>
                <p>업로드한 이미지는 분석용으로만 사용되며 별도로 저장되지 않습니다.</p>
            </div>
            <div className="feature-card">
                <div className="feature-icon">👨‍⚕️</div>
                <h3>전문가 상담</h3>
                <p>분석 결과에 따라 전문 의료진과 무료 상담을 신청할 수 있습니다.</p>
            </div>
        </div>
    </section>
);

const HowToUse = () => (
    <section className="how-to-use-section">
        <h2>사용 방법</h2>
        <div className="steps-container">
            <div className="step-item">
                <div className="step-number">1</div>
                <div className="step-content">
                    <h3>사진 촬영</h3>
                    <p>상의를 탈의하거나 몸에 붙는 옷을 입고 등 전체가 보이게 촬영하세요.</p>
                </div>
            </div>
            <div className="step-item">
                <div className="step-number">2</div>
                <div className="step-content">
                    <h3>업로드</h3>
                    <p>'사진 업로드' 또는 '카메라' 버튼을 눌러 사진을 등록하세요.</p>
                </div>
            </div>
            <div className="step-item">
                <div className="step-number">3</div>
                <div className="step-content">
                    <h3>결과 확인</h3>
                    <p>AI가 분석한 콥스 각도와 위험도 단계를 확인하세요.</p>
                </div>
            </div>
        </div>
    </section>
);

const Logo = () => (
    <div className="app-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}>
            {/* Redesigned Spine Symbol: 1:1 Aspect Ratio (Square-ish), Wide, Flat */}
            {/* Top Vertebra */}
            <path d="M2 6L12 11L22 6L12 2L2 6Z" fill="#ef4444"/>
            {/* Middle Vertebra */}
            <path d="M2 12L12 17L22 12L12 8L2 12Z" fill="#ef4444"/>
            {/* Bottom Vertebra */}
            <path d="M2 18L12 23L22 18L12 14L2 18Z" fill="#ef4444"/>
        </svg>
        <span>ScolioAI</span>
    </div>
);

const Hero = ({ onSettingsClick, onHistoryClick, onShareClick, showSettingsAlert }: { 
    onSettingsClick: () => void, 
    onHistoryClick: () => void, 
    onShareClick: () => void,
    showSettingsAlert: boolean 
}) => (
    <div className="hero">
        <div className="hero-top-bar">
            <Logo />
            <div className="hero-actions">
                 <button onClick={onShareClick} className="hero-icon-btn" aria-label="Share">
                    {/* Standard Share Node Icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                 </button>
                 <button onClick={onHistoryClick} className="hero-icon-btn" aria-label="History">
                    🕒
                 </button>
                 <div className="settings-btn-container">
                    <button onClick={onSettingsClick} className="hero-icon-btn" aria-label="Settings">
                        ⚙️
                    </button>
                    {showSettingsAlert && <span className="settings-alert-dot"></span>}
                </div>
            </div>
        </div>
        <div className="hero-content">
            <h1>척추 건강,<br/>AI로 간편하게 확인하세요</h1>
            <p>병원에 가지 않아도, 사진 한 장으로<br/>척추측만증 위험도를 바로 분석해 드립니다.</p>
        </div>
    </div>
);

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  
  // Modals
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [formMessage, setFormMessage] = useState<{type: string, text: string} | null>(null);
  
  // State for manual API key input
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [envKeyDetected, setEnvKeyDetected] = useState<boolean>(false);
  
  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize
  useEffect(() => {
    const config = getEnvConfig();
    
    if (config.apiKey) {
        setEnvKeyDetected(true);
    } else {
        setEnvKeyDetected(false);
    }

    const initEmailJS = () => {
        if (window.emailjs) {
            try {
                const publicKey = config.emailJs.publicKey || 'YOUR_PUBLIC_KEY';
                window.emailjs.init({ publicKey });
            } catch (e) {
                console.error("EmailJS init failed:", e);
            }
        }
    };
    
    // Load local storage
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setManualApiKey(savedKey);

    const savedHistory = localStorage.getItem('scolio_history');
    if (savedHistory) {
        try {
            setHistory(JSON.parse(savedHistory));
        } catch (e) {}
    }
    
    if (document.readyState === 'complete') {
        initEmailJS();
    } else {
        window.addEventListener('load', initEmailJS);
        return () => window.removeEventListener('load', initEmailJS);
    }
  }, []);

  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setResult(null);
      setError('');
      setTimeout(() => {
        document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSaveApiKey = (key: string) => {
      const trimmedKey = key.trim();
      if (trimmedKey.length > 10) {
          localStorage.setItem('gemini_api_key', trimmedKey);
          setManualApiKey(trimmedKey);
          setError('');
          setIsSettingsModalOpen(false);
          alert("API Key가 저장되었습니다. 이제 분석을 시작해보세요.");
      } else {
          alert("유효한 API Key를 입력해주세요.");
      }
  };

  const saveToHistory = (newResult: AnalysisResult) => {
      const newItem: HistoryItem = {
          ...newResult,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now()
      };
      const updatedHistory = [newItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('scolio_history', JSON.stringify(updatedHistory));
  };

  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'ScolioAI - 척추측만증 AI 분석',
                text: 'AI로 간편하게 척추 건강을 체크해보세요!',
                url: window.location.href,
            });
        } catch (err) {
            console.log('Error sharing', err);
        }
    } else {
        try {
            await navigator.clipboard.writeText(window.location.href);
            alert('주소가 복사되었습니다. 친구에게 공유해보세요!');
        } catch (err) {
            alert('공유하기 기능을 지원하지 않는 브라우저입니다.');
        }
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('이미지를 먼저 업로드해주세요.');
      return;
    }

    const envConfig = getEnvConfig();
    let apiKey = envConfig.apiKey;
    
    if (!apiKey) apiKey = manualApiKey;
    if (!apiKey) apiKey = localStorage.getItem('gemini_api_key') || '';

    if (!apiKey) {
        setIsSettingsModalOpen(true);
        setError('API Key가 필요합니다. 설정창에서 입력해주세요.');
        return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });

      let base64Data = '';
      try {
        base64Data = await compressImage(imageFile);
      } catch (imgError) {
        throw new Error("이미지 처리 실패: 파일이 너무 크거나 손상되었습니다.");
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            {
              text: "Analyze this back image for scoliosis. Protocol:\n1. Check image quality. If bad/irrelevant, return cobbAngle -1, classification 'Inconclusive'.\n2. Calculate Cobb angle.\n3. Classify: Normal (<10), Mild (10-24), High-Risk (>=25).\nReturn JSON: {cobbAngle: number, classification: string}",
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cobbAngle: { type: Type.NUMBER },
              classification: { type: Type.STRING },
            },
            required: ['cobbAngle', 'classification'],
          },
        },
      });
      
      if (!response.text) throw new Error("AI 응답이 없습니다.");

      const resultJson = JSON.parse(response.text);
      setResult(resultJson);
      saveToHistory(resultJson);

    } catch (e: any) {
      console.error(e);
      let errorMsg = '분석 중 오류가 발생했습니다.';
      const errorString = e.toString().toLowerCase();
      
      // Billing/Quota handling
      if (errorString.includes('429') || errorString.includes('quota')) {
           errorMsg = '무료 사용량이 초과되었습니다. 설정(⚙️)에서 본인의 API Key를 등록하면 계속 사용할 수 있습니다.';
           setIsSettingsModalOpen(true);
      } else if (errorString.includes('key') || errorString.includes('403') || errorString.includes('401')) {
          errorMsg = 'API Key 인증 실패. 설정창에서 키를 다시 확인해주세요.';
          setIsSettingsModalOpen(true);
      } else if (errorString.includes('400')) {
          errorMsg = '이미지 오류: 다른 사진으로 시도해보세요.';
      } else if (errorString.includes('safety')) {
          errorMsg = 'AI가 이미지를 분석할 수 없습니다. (콘텐츠 정책)';
      } else {
          errorMsg += ' 네트워크 상태를 확인해주세요.';
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setImageUrl('');
    setResult(null);
    setError('');
    if(fileInputRef.current) fileInputRef.current.value = '';
    if(cameraInputRef.current) cameraInputRef.current.value = '';
    window.scrollTo(0, 0);
  };

  const getResultCardClassName = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'normal': return 'normal';
      case 'mild': return 'mild';
      case 'high-risk': return 'high-risk';
      case 'inconclusive': return 'high-risk'; 
      default: return '';
    }
  };
  
  const handleFormSubmit = async (formData: any) => {
        setIsSending(true);
        setFormMessage(null);
        try {
            if (!window.emailjs) throw new Error("Email service not available");
            
            const config = getEnvConfig();
            const serviceID = config.emailJs.serviceId || 'YOUR_SERVICE_ID';
            const templateID = config.emailJs.templateId || 'YOUR_TEMPLATE_ID';

            await window.emailjs.send(serviceID, templateID, {
                ...formData,
                cobb_angle: result?.cobbAngle?.toFixed(1), 
                classification: result?.classification,
            });
            setFormMessage({ type: 'success', text: '상담 신청이 성공적으로 전송되었습니다.'});
            setTimeout(() => { setIsConsultationModalOpen(false); }, 3000);
        } catch (error) {
            console.error('EmailJS error:', error);
            setFormMessage({ type: 'error', text: '전송 실패. 키 설정을 확인하거나 잠시 후 다시 시도해주세요.'});
        } finally {
            setIsSending(false);
        }
  };

  const getResultContent = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'normal': return <p>척추가 <strong>정상</strong> 범위에 있습니다.</p>;
      case 'mild': return <p><strong>경미한 척추측만증</strong>이 의심됩니다. 전문의와 상담을 권장합니다.</p>;
      case 'high-risk': return <p><strong>척추측만증 고위험군</strong>으로 분류됩니다. 전문가의 진단이 필요합니다.</p>;
      case 'inconclusive': return <p><strong>분석 실패</strong>: 사진이 명확하지 않습니다. 밝고 선명한 등 사진으로 다시 시도해주세요.</p>;
      default: return <p>분석 결과를 확인하세요.</p>;
    }
  }

  const showSettingsAlert = !envKeyDetected && !manualApiKey;

  return (
    <>
    <div className="container">
      {!result && (
          <>
            <Hero 
                onSettingsClick={() => setIsSettingsModalOpen(true)} 
                onHistoryClick={() => setIsHistoryModalOpen(true)}
                onShareClick={handleShare}
                showSettingsAlert={showSettingsAlert} 
            />
            
            <div className="action-card">
                <p className="upload-guide-text">분석할 사진을 선택해주세요</p>
                <div className="button-group main-actions">
                    <button className="btn btn-lg" onClick={() => fileInputRef.current?.click()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>
                        사진 업로드
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => cameraInputRef.current?.click()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828-.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>
                        카메라 촬영
                    </button>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" aria-hidden="true" />
                    <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" aria-hidden="true" />
                </div>
            </div>

            {imageFile && (
                <div id="preview-section" className="preview-card">
                    <h3>선택된 이미지</h3>
                    <div className="image-preview-container">
                        <img src={imageUrl} alt="Uploaded preview" className="image-preview" />
                    </div>
                    
                    {error && (
                        <div className="error-message">
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {isLoading ? (
                         <div>
                            <div className="loader"></div>
                            <p className='loading-text'>AI가 척추 각도를 정밀 분석 중입니다...<br/><small>(약 5-10초 소요)</small></p>
                        </div>
                    ) : (
                        <button className="btn btn-block analyze-btn" onClick={handleAnalyze}>
                            AI 분석 시작하기
                        </button>
                    )}
                </div>
            )}

            {!imageFile && (
                <>
                    <Features />
                    <HowToUse />
                </>
            )}
          </>
      )}

      {/* Result Section */}
      {result && (
        <div className="results-section">
            <div className="result-header">
               <h2>분석 결과</h2>
               <div className="result-actions">
                   <button onClick={handleShare} className="icon-btn-secondary" title="공유하기">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                   </button>
                   <button onClick={handleReset} className="text-btn">처음으로</button>
               </div>
            </div>
          
          <div className="image-preview-container" style={{maxHeight:'300px', marginBottom: '1.5rem'}}>
             <img src={imageUrl} alt="Analyzed image" className="image-preview" style={{objectFit:'contain', height:'100%'}} />
          </div>

          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            <p className="result-label">Cobb Angle (콥스 각도)</p>
            <p>
              <strong>{result.cobbAngle === -1 ? '--' : result.cobbAngle.toFixed(1)}°</strong>
            </p>
          </div>
          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            {getResultContent(result.classification)}
          </div>
          
          <div className="button-group vertical">
            <button
              onClick={() => { setFormMessage(null); setIsConsultationModalOpen(true); }}
              className="btn btn-block"
            >
              전문가에게 무료 상담 신청하기
            </button>
             <button onClick={handleReset} className="btn btn-secondary btn-block">다시 검사하기</button>
          </div>
          
          <p className="disclaimer">
            * 본 AI 분석 결과는 참고용이며, 정확한 진단은 반드시 전문 의료기관과 상담하시기 바랍니다.
          </p>
        </div>
      )}
      
      <footer className="app-footer">
        <p>&copy; 2025 ScolioAI. All rights reserved.</p>
      </footer>
    </div>
    
    {isConsultationModalOpen && <ConsultationModal onClose={() => setIsConsultationModalOpen(false)} onSubmit={handleFormSubmit} isSending={isSending} formMessage={formMessage}/>}
    {isSettingsModalOpen && <SettingsModal onClose={() => setIsSettingsModalOpen(false)} currentKey={manualApiKey} onSave={handleSaveApiKey} envKeyDetected={envKeyDetected} />}
    {isHistoryModalOpen && <HistoryModal onClose={() => setIsHistoryModalOpen(false)} history={history} />}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
