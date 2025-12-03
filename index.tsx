
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
                <form onSubmit={handleSubmit}>
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

// Settings Modal for Manual API Key
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
                    {!envKeyDetected && (
                        <p style={{fontSize: '0.8rem', color: '#666', marginTop: '5px'}}>
                            정적 웹사이트(Static) 배포 시 환경 변수를 읽지 못할 수 있습니다. 아래에 키를 직접 입력하면 해결됩니다.
                        </p>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="apiKey">Gemini API Key 직접 입력</label>
                    <input 
                        type="password" 
                        id="apiKey" 
                        value={key} 
                        onChange={(e) => setKey(e.target.value)} 
                        placeholder="AIza..."
                    />
                </div>
                <div className="button-group">
                    <button className="btn" onClick={() => onSave(key)}>저장하기</button>
                </div>
            </div>
        </div>
    );
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

const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{ cobbAngle: number; classification: string; } | null>(null);
  const [error, setError] = useState<string>('');
  
  const [isConsultationModalOpen, setIsConsultationModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [formMessage, setFormMessage] = useState<{type: string, text: string} | null>(null);
  
  // State for manual API key input
  const [manualApiKey, setManualApiKey] = useState<string>('');
  const [envKeyDetected, setEnvKeyDetected] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize EmailJS and check for API keys
  useEffect(() => {
    const config = getEnvConfig();
    
    // Check if Env Key is present
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
    
    // Load manual API key from local storage
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        setManualApiKey(savedKey);
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

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('이미지를 먼저 업로드해주세요.');
      return;
    }

    const envConfig = getEnvConfig();
    let apiKey = envConfig.apiKey;
    
    if (!apiKey) {
        apiKey = manualApiKey;
    }
    
    // If still no key, verify local storage as last resort
    if (!apiKey) {
        apiKey = localStorage.getItem('gemini_api_key') || '';
    }

    if (!apiKey) {
        // If no key found anywhere, open settings modal automatically
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
      
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            imagePart,
            {
              text: "You are an expert orthopedic AI assistant specializing in scoliosis analysis. Your task is to meticulously analyze the provided image of a human back to estimate the Cobb angle.\n\nProtocol:\n1. Identify if the image is a clear photo of a human back suitable for analysis. If the image is blurry, irrelevant (not a back), or too dark/low-quality to determine landmarks, return `cobbAngle: -1` and `classification: 'Inconclusive'`.\n2. If the image is valid, identify Spinal Landmarks (vertebral column).\n3. Determine Upper and Lower End Vertebrae.\n4. Calculate the Cobb angle.\n5. Classify Severity:\n   - Normal: < 10 degrees\n   - Mild: 10-24 degrees\n   - High-Risk: >= 25 degrees\n\nReturn a JSON object containing only the calculated `cobbAngle` (number, rounded to one decimal place) and `classification` string.",
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cobbAngle: {
                type: Type.NUMBER,
                description: 'The calculated Cobb angle in degrees. Return -1 if analysis fails due to image quality.',
              },
              classification: {
                type: Type.STRING,
                description: "Classification: 'Normal', 'Mild', 'High-Risk', or 'Inconclusive'.",
              },
            },
            required: ['cobbAngle', 'classification'],
          },
        },
      });
      
      if (!response.text) {
          throw new Error("AI 응답이 없습니다.");
      }

      const resultJson = JSON.parse(response.text);
      setResult(resultJson);

    } catch (e: any) {
      console.error(e);
      let errorMsg = '분석 중 오류가 발생했습니다.';
      const errorString = e.toString().toLowerCase();
      
      if (errorString.includes('api key') || errorString.includes('403') || errorString.includes('401')) {
          errorMsg = 'API Key 인증 실패. 설정창에서 키를 다시 확인해주세요.';
          setIsSettingsModalOpen(true); // Auto-open settings on auth error
      } else if (errorString.includes('400')) {
          errorMsg = '이미지 오류: 다른 사진으로 시도해보세요.';
      } else if (errorString.includes('safety')) {
          errorMsg = 'AI가 이미지를 분석할 수 없습니다. (콘텐츠 정책)';
      } else {
          errorMsg += ' 네트워크 상태나 이미지 형식을 확인해주세요.';
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
                cobb_angle: result?.cobbAngle.toFixed(1), 
                classification: result?.classification,
            });
            setFormMessage({ type: 'success', text: '상담 신청이 성공적으로 전송되었습니다.'});
            setTimeout(() => { setIsConsultationModalOpen(false); }, 3000);
        } catch (error) {
            console.error('EmailJS error:', error);
            setFormMessage({ type: 'error', text: '전송 실패. 잠시 후 다시 시도해주세요.'});
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

  // Determine if we need to alert the user about missing keys
  const showSettingsAlert = !envKeyDetected && !manualApiKey;

  return (
    <>
    <div className="container">
      <header style={{position: 'relative'}}>
        <h1>척추측만증 AI 분석</h1>
        <p>사진 한 장으로 척추의 휨 정도를 확인해보세요.</p>
        <div style={{position: 'absolute', top: '-10px', right: '-10px'}}>
            <button 
                onClick={() => setIsSettingsModalOpen(true)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: '#999',
                    padding: '5px'
                }}
                aria-label="Settings"
            >
                ⚙️
            </button>
            {showSettingsAlert && (
                <span style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#dc3545',
                    borderRadius: '50%',
                    boxShadow: '0 0 0 2px white'
                }}></span>
            )}
        </div>
      </header>

      {!result && !isLoading && (
        <>
        <div className="upload-section">
            <p>허리가 잘 보이는 상반신 뒷면 사진을 업로드해주세요.</p>
            <div className="button-group">
                <button className="btn" onClick={() => fileInputRef.current?.click()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>
                    사진 업로드
                </button>
                <button className="btn btn-secondary" onClick={() => cameraInputRef.current?.click()}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828-.828A2 2 0 0 1 3.172 4H2zm.5 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm9 2.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z"/></svg>
                    카메라로 촬영
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" aria-hidden="true" />
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => handleFileSelect(e.target.files)} className="hidden" aria-hidden="true" />
            </div>
        </div>
        
        {imageUrl && (
            <div className="image-preview-container">
            <img src={imageUrl} alt="Uploaded preview" className="image-preview" />
            </div>
        )}

        {imageFile && (
            <div className="analyze-button-container">
            <button className="btn" onClick={handleAnalyze} disabled={isLoading}>
                분석 시작
            </button>
            </div>
        )}
        </>
      )}


      {isLoading && (
        <div>
          <div className="loader"></div>
          <p className='loading-text'>AI가 척추 각도를 분석 중입니다...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
            <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="results-section">
          <h2>분석 결과</h2>
          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            <p>
              <strong>{result.cobbAngle === -1 ? '--' : result.cobbAngle.toFixed(1)}°</strong>
              {result.cobbAngle === -1 ? '측정 불가' : '콥스 각도'}
            </p>
          </div>
          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            {getResultContent(result.classification)}
          </div>
          <div className="button-group">
            <button onClick={handleReset} className="btn btn-secondary">다시 검사하기</button>
            <button
              onClick={() => { setFormMessage(null); setIsConsultationModalOpen(true); }}
              className="btn"
            >
              무료상담하러 가기
            </button>
          </div>
          <p className="disclaimer">
            * 본 AI 분석 결과는 참고용이며, 정확한 진단은 반드시 전문 의료기관과 상담하시기 바랍니다.
          </p>
        </div>
      )}
    </div>
    {isConsultationModalOpen && <ConsultationModal onClose={() => setIsConsultationModalOpen(false)} onSubmit={handleFormSubmit} isSending={isSending} formMessage={formMessage}/>}
    {isSettingsModalOpen && <SettingsModal onClose={() => setIsSettingsModalOpen(false)} currentKey={manualApiKey} onSave={handleSaveApiKey} envKeyDetected={envKeyDetected} />}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
