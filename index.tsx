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


const App: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{ cobbAngle: number; classification: string; } | null>(null);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [formMessage, setFormMessage] = useState<{type: string, text: string} | null>(null);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // IMPORTANT: Replace with your actual EmailJS Public Key
    window.emailjs.init({ publicKey: 'YOUR_PUBLIC_KEY' });
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
  
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve((reader.result as string).split(',')[1]);
        } else {
          reject('Failed to convert blob to base64');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError('Please upload an image first.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

      const base64Data = await blobToBase64(imageFile);
      const imagePart = {
        inlineData: {
          mimeType: imageFile.type,
          data: base64Data,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            imagePart,
            {
              text: "You are an expert orthopedic AI assistant specializing in scoliosis analysis. Your task is to meticulously analyze the provided image of a human back to estimate the Cobb angle with the highest possible accuracy. Follow this precise protocol:\n\n1.  **Identify Spinal Landmarks:** First, carefully identify the vertebral column in the image. Scan the entire spine to locate the primary curve.\n2.  **Determine End Vertebrae:**\n    *   Identify the **upper end vertebra**: This is the most superior vertebra of the curve that tilts the most towards the concave side of the curve.\n    *   Identify the **lower end vertebra**: This is the most inferior vertebra of the curve that tilts the most towards the concave side of the curve.\n3.  **Simulate Line Placement:**\n    *   Mentally draw a line parallel to the **superior endplate** (the top surface) of the upper end vertebra.\n    *   Mentally draw another line parallel to the **inferior endplate** (the bottom surface) of the lower end vertebra.\n4.  **Calculate Cobb Angle:** Calculate the precise angle where these two lines intersect. This value is the Cobb angle.\n5.  **Classify Severity:** Based on the calculated angle, classify the condition using these standard medical thresholds:\n    *   **Normal**: Less than 10 degrees.\n    *   **Mild**: 10 to 24 degrees.\n    *   **High-Risk**: 25 degrees or more.\n\nReturn a JSON object containing only the calculated `cobbAngle` (as a number, rounded to one decimal place) and the corresponding `classification` string. Your analysis must be as accurate as a clinical assessment.",
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
                description: 'The calculated Cobb angle in degrees, rounded to one decimal place.',
              },
              classification: {
                type: Type.STRING,
                description: "Classification of the condition: 'Normal', 'Mild', or 'High-Risk'.",
              },
            },
            required: ['cobbAngle', 'classification'],
          },
        },
      });
      
      const resultJson = JSON.parse(response.text);
      setResult(resultJson);

    } catch (e) {
      console.error(e);
      setError('An error occurred during analysis. Please ensure the image clearly shows the back and try again.');
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
      case 'normal':
        return 'normal';
      case 'mild':
        return 'mild';
      case 'high-risk':
        return 'high-risk';
      default:
        return '';
    }
  };
  
    const handleFormSubmit = async (formData: any) => {
        setIsSending(true);
        setFormMessage(null);
        try {
            // IMPORTANT: Replace with your actual EmailJS Service ID and Template ID
            const serviceID = 'YOUR_SERVICE_ID';
            const templateID = 'YOUR_TEMPLATE_ID';

            await window.emailjs.send(serviceID, templateID, {
                ...formData,
                cobb_angle: result?.cobbAngle.toFixed(1), // Pass result data to template
                classification: result?.classification,
            });
            setFormMessage({ type: 'success', text: '상담 신청이 성공적으로 전송되었습니다. 곧 연락드리겠습니다.'});
            setTimeout(() => {
                setIsModalOpen(false);
            }, 3000);
        } catch (error) {
            console.error('EmailJS error:', error);
            setFormMessage({ type: 'error', text: '전송 중 오류가 발생했습니다. 다시 시도해주세요.'});
        } finally {
            setIsSending(false);
        }
    };


  const getResultContent = (classification: string) => {
    switch (classification.toLowerCase()) {
      case 'normal':
        return <p>척추가 <strong>정상</strong> 범위에 있습니다.</p>;
      case 'mild':
        return <p><strong>경미한 척추측만증</strong>이 의심됩니다. 전문의와 상담을 권장합니다.</p>;
      case 'high-risk':
        return <p><strong>척추측만증 고위험군</strong>으로 분류됩니다. 빠른 시일 내에 전문가의 진단이 필요합니다.</p>;
      default:
        return <p>분석 결과를 확인하세요.</p>;
    }
  }


  return (
    <>
    <div className="container">
      <header>
        <h1>척추측만증 AI 분석</h1>
        <p>사진 한 장으로 척추의 휨 정도를 확인해보세요.</p>
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

      {error && <p className="error-message">{error}</p>}

      {result && (
        <div className="results-section">
          <h2>분석 결과</h2>
          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            <p>
              <strong>{result.cobbAngle.toFixed(1)}°</strong>
              콥스 각도
            </p>
          </div>
          <div className={`result-card ${getResultCardClassName(result.classification)}`}>
            {getResultContent(result.classification)}
          </div>
          <div className="button-group">
            <button onClick={handleReset} className="btn btn-secondary">다시 검사하기</button>
            <button
              onClick={() => { setFormMessage(null); setIsModalOpen(true); }}
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
    {isModalOpen && <ConsultationModal onClose={() => setIsModalOpen(false)} onSubmit={handleFormSubmit} isSending={isSending} formMessage={formMessage}/>}
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);