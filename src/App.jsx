// src/App.js
import { useState } from 'react';
import axios from 'axios';
import './App.css';

const API = import.meta.env.API_BASE_URL || 'http://localhost:5000';

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [paragraphNumbers, setParagraphNumbers] = useState('');
  const [extractedParagraphs, setExtractedParagraphs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [notification, setNotification] = useState(null);
  const [textEdited, setTextEdited] = useState(false);
  const [textSaved, setTextSaved] = useState(false);
  const [pdfId, setPdfId] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      // Resetear estados relacionados con el procesamiento
      setRawText('');
      setEditedText('');
      setExtractedParagraphs([]);
      setTextEdited(false);
      setTextSaved(false);
    } else {
      showNotification('Por favor, selecciona un archivo PDF válido', 'error');
    }
  };

  const handleParagraphNumbersChange = (e) => {
    setParagraphNumbers(e.target.value);
  };

  const handleEditedTextChange = (e) => {
    setEditedText(e.target.value);
    setTextEdited(rawText !== e.target.value);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const processPDF = async () => {
    if (!file) {
      showNotification('Por favor, selecciona un archivo PDF', 'error');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await axios.post(`${API}/process-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setRawText(response.data.rawText);
      setEditedText(response.data.rawText);
      setPdfId(response.data.pdfId);
      setCurrentStep(2);
      showNotification('PDF procesado con éxito', 'success');
    } catch (error) {
      console.error('Error processing PDF:', error);
      showNotification('Error al procesar el PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveEditedText = async () => {
    if (!pdfId || !textEdited) {
      if (!textEdited) {
        showNotification('No hay cambios para guardar', 'info');
      }
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/save-edited-text`, {
        pdfId,
        editedText
      });

      setTextEdited(false);
      setTextSaved(true);
      showNotification('Texto editado guardado con éxito', 'success');
    } catch (error) {
      console.error('Error saving edited text:', error);
      showNotification('Error al guardar el texto editado', 'error');
    } finally {
      setLoading(false);
    }
  };

  const extractParagraphs = async () => {
    if (!pdfId) {
      showNotification('Primero debes procesar un PDF', 'error');
      return;
    }

    if (!paragraphNumbers.trim()) {
      showNotification('Por favor, ingresa los números de párrafos', 'error');
      return;
    }

    if (textEdited && !textSaved) {
      showNotification('Guarda tus cambios antes de extraer párrafos', 'error');
      return;
    }

    // Convertir entrada de texto a array de números
    const numbersArray = paragraphNumbers.split(',').map(num => num.trim()).filter(Boolean);
    
    if (numbersArray.length === 0) {
      showNotification('Por favor, ingresa números de párrafos válidos', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/extract-from-edited`, {
        pdfId,
        paragraphNumbers: JSON.stringify(numbersArray.map(Number))
      });

      console.log(response.data.extractedParagraphs);
      setExtractedParagraphs(response.data.extractedParagraphs);
      setCurrentStep(3);
      showNotification('Párrafos extraídos con éxito', 'success');
    } catch (error) {
      console.error('Error extracting paragraphs:', error);
      showNotification('Error al extraer párrafos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setFile(null);
    setFileName('');
    setRawText('');
    setEditedText('');
    setParagraphNumbers('');
    setExtractedParagraphs([]);
    setCurrentStep(1);
    setPdfId(null);
    setTextEdited(false);
    setTextSaved(false);
  };

  return (
    <div className="App">
      <h1>Extractor y Editor de Párrafos PDF</h1>
      
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="steps-container">
        <div className={`step ${currentStep === 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div>Subir y Procesar PDF</div>
        </div>
        <div className={`step ${currentStep === 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div>Editar Texto Procesado</div>
        </div>
        <div className={`step ${currentStep === 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div>Extraer Párrafos</div>
        </div>
      </div>
      
      {currentStep === 1 && (
        <div className="app-section upload-section">
          <div className="section-title">Sube tu archivo PDF</div>
          <div className="file-input-container">
            <div className="file-input-label">
              {fileName ? fileName : "Haz clic aquí para seleccionar un archivo PDF"}
            </div>
            <input type="file" accept=".pdf" onChange={handleFileChange} />
          </div>
          {fileName && <div className="file-name">Archivo seleccionado: {fileName}</div>}
          
          <button 
            className={`btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
            onClick={processPDF}
            disabled={loading || !file}
          >
            {loading ? 'Procesando...' : 'Procesar PDF'}
          </button>
        </div>
      )}
      
      {currentStep === 2 && (
        <>
          <div className="app-section text-edit-section">
            <div className="section-title">Edita el texto procesado</div>
            <div className="section-description">
              Puedes editar el texto extraído del PDF. Estos cambios se aplicarán cuando extraigas párrafos específicos.
            </div>
            <textarea
              className="full-text-editor"
              value={editedText}
              onChange={handleEditedTextChange}
            />
            <div className="edit-actions">
              <button 
                className={`btn ${loading ? 'btn-disabled' : textEdited ? 'btn-success' : 'btn-primary-outline'}`}
                onClick={saveEditedText}
                disabled={loading || !textEdited}
              >
                {loading ? 'Guardando...' : textEdited ? 'Guardar Cambios' : 'Sin Cambios'}
              </button>
            </div>
          </div>
          
          <div className="app-section paragraph-section">
            <div className="section-title">Indica los números de párrafos a extraer</div>
            <div className="section-description">
              Ingresa los números de párrafos separados por comas (ej: 1, 3, 5)
            </div>
            <div className="paragraph-input-container">
              <input
                type="text"
                className="paragraph-input"
                placeholder="Ejemplo: 1, 2, 5, 10"
                value={paragraphNumbers}
                onChange={handleParagraphNumbersChange}
              />
              <button 
                className={`btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
                onClick={extractParagraphs}
                disabled={loading || textEdited && !textSaved}
              >
                {loading ? 'Extrayendo...' : 'Extraer Párrafos'}
              </button>
            </div>
            {textEdited && !textSaved && (
              <div className="warning-message">
                ⚠️ Guarda tus cambios antes de extraer párrafos
              </div>
            )}
          </div>
        </>
      )}
      
      {currentStep === 3 && (
      <>
        <div className="app-section">
          <div className="section-title">Párrafos Extraídos</div>
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
          ) : extractedParagraphs.length > 0 ? (
            <div className="extracted-paragraphs">
              {extractedParagraphs.map((paragraph, index) => (
                <div key={index} className="paragraph-card">
                  <div className="paragraph-number">Párrafo {paragraph.number}</div>
                  <div className="paragraph-content">
                    <div className="paragraph-text" dangerouslySetInnerHTML={{ __html: paragraph.text }} />
                    {paragraph.keywords && paragraph.keywords.length > 0 && (
                      <div className="paragraph-keywords">
                        <h4>Palabras clave:</h4>
                        <div className="keywords-container">
                          {/* Corregir aquí: keywords ya es un array, no necesitamos split */}
                          {paragraph.keywords.map((keyword, i) => (
                            <span key={i} className="keyword-tag">{keyword}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>No se encontraron párrafos. Intenta con otros números.</div>
          )}
        </div>
        
        <div className="app-section action-buttons">
          <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
            Volver a Editar
          </button>
          <button className="btn btn-primary" onClick={resetApp}>
            Procesar Nuevo PDF
          </button>
        </div>
      </>
    )}
    </div>
  );
}

export default App;