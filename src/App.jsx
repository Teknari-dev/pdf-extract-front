// src/App.js
import { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Definir siglas en el ámbito global
const siglas = {
  'CCPR': 1,
  'CESCR': 2,
  'CERD': 3,
  'CEDAW': 4,
  'CAT': 5,
  'CRC': 6,
  'CMW': 7,
  'CRDP': 8,
  'CED': 9
};

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [rawText, setRawText] = useState('');
  const [editedText, setEditedText] = useState('');
  const [paragraphNumbers, setParagraphNumbers] = useState('');
  const [extractedParagraphs, setExtractedParagraphs] = useState([]);
  const [keywordIndex, setKeywordIndex] = useState([]);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [notification, setNotification] = useState(null);
  const [textEdited, setTextEdited] = useState(false);
  const [textSaved, setTextSaved] = useState(false);
  const [pdfId, setPdfId] = useState(null);
  const [currentPdfIndex, setCurrentPdfIndex] = useState(null);
  const [multiExtractMode, setMultiExtractMode] = useState(false);
  const [pdfParagraphNumbers, setPdfParagraphNumbers] = useState({});
  const [pdfCitations, setPdfCitations] = useState({});
  const [structuralFormData, setStructuralFormData] = useState({
    titulo: '',
    subtitulo: '',
    categoria1: '',
    categoria2: '',
    encabezado: ''
  });
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(
      file => file.type === 'application/pdf'
    );
    
    if (selectedFiles.length > 0) {
      const newFiles = selectedFiles.map(file => ({
        file,
        name: file.name,
        selected: true,
        processed: false,
        id: Math.random().toString(36).substr(2, 9)
      }));
      
      // Generar citas para los nuevos archivos
      const newCitations = {};
      newFiles.forEach(file => {
        const citation = generateCitation(file.name);
        if (citation) {
          newCitations[file.id] = citation;
        }
      });
      
      setPdfCitations(prev => ({ ...prev, ...newCitations }));
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      setSelectedFiles(newFiles);
      
      if (selectedFiles.length === 1) {
        showNotification(`Se ha añadido "${selectedFiles[0].name}"`, 'success');
      } else {
        showNotification(`Se han añadido ${selectedFiles.length} archivos PDF`, 'success');
      }
    } else {
      showNotification('No se seleccionaron archivos PDF válidos', 'error');
    }
  };

  const toggleFileSelection = (id) => {
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === id ? { ...file, selected: !file.selected } : file
      )
    );
    
    // Actualizar el array de archivos seleccionados
    const updatedFiles = files.map(file => 
      file.id === id ? { ...file, selected: !file.selected } : file
    );
    
    setSelectedFiles(updatedFiles.filter(file => file.selected));
  };

  const toggleSelectAll = () => {
    const allSelected = files.every(file => file.selected);
    
    setFiles(prevFiles => 
      prevFiles.map(file => ({ ...file, selected: !allSelected }))
    );
    
    if (allSelected) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...files]);
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

  const processPDFs = async () => {
    const selectedFilesToProcess = files.filter(file => file.selected);
    
    if (selectedFilesToProcess.length === 0) {
      showNotification('Por favor, selecciona al menos un archivo PDF', 'error');
      return;
    }

    setLoading(true);

    try {
      // Procesar el primer archivo seleccionado
      await processSelectedPDF(selectedFilesToProcess[0].id);
      setCurrentStep(2);
      showNotification('PDF procesado con éxito', 'success');
    } catch (error) {
      console.error('Error processing PDFs:', error);
      showNotification('Error al procesar los PDFs', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const processSelectedPDF = async (id) => {
    const fileToProcess = files.find(file => file.id === id);
    if (!fileToProcess) return;

    setLoading(true);

    const formData = new FormData();
    formData.append('pdf', fileToProcess.file);

    try {
      const response = await axios.post(`${API}/process-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Generar y almacenar la cita para este archivo
      const citation = generateCitation(fileToProcess.name);
      if (citation) {
        setPdfCitations(prev => ({
          ...prev,
          [id]: citation
        }));
      }

      setRawText(response.data.rawText);
      setEditedText(response.data.rawText);
      setPdfId(response.data.pdfId);
      setCurrentPdfIndex(id);
      
      // Marcar el archivo como procesado y guardar sus datos
      setFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === id ? { 
            ...file, 
            processed: true,
            rawText: response.data.rawText,
            editedText: response.data.rawText,
            pdfId: response.data.pdfId
          } : file
        )
      );
      
      showNotification(`${fileToProcess.name} procesado con éxito`, 'success');
    } catch (error) {
      console.error('Error processing PDF:', error);
      showNotification(`Error al procesar ${fileToProcess.name}`, 'error');
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

      // También actualizar el texto editado en el estado de files
      setFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === currentPdfIndex 
            ? { ...file, editedText: editedText } 
            : file
        )
      );

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

    // Obtener los valores del formulario estructural
    const titulo = document.getElementById('titulo')?.value || '';
    const subtitulo = document.getElementById('subtitulo')?.value || '';
    const categoria1 = document.getElementById('categoria1')?.value || '';
    const categoria2 = document.getElementById('categoria2')?.value || '';
    const encabezado = document.getElementById('encabezado')?.value || '';

    // Guardar los valores en el estado
    setStructuralFormData({
      titulo,
      subtitulo,
      categoria1,
      categoria2,
      encabezado
    });

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

      setExtractedParagraphs(response.data.extractedParagraphs);
      setKeywordIndex(response.data.keywordIndex);
      setCurrentStep(3);
      showNotification('Párrafos extraídos con éxito', 'success');
    } catch (error) {
      console.error('Error extracting paragraphs:', error);
      showNotification('Error al extraer párrafos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const extractAllParagraphs = async () => {
    if (!pdfId) {
      showNotification('Primero debes procesar un PDF', 'error');
      return;
    }

    if (textEdited && !textSaved) {
      showNotification('Guarda tus cambios antes de extraer párrafos', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/extract-all-paragraphs`, {
        pdfId
      });

      setExtractedParagraphs(response.data.extractedParagraphs);
      setKeywordIndex(response.data.keywordIndex);
      setCurrentStep(3);
      showNotification('Todos los párrafos extraídos con éxito', 'success');
    } catch (error) {
      console.error('Error extracting paragraphs:', error);
      showNotification('Error al extraer párrafos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setFiles([]);
    setSelectedFiles([]);
    setRawText('');
    setEditedText('');
    setParagraphNumbers('');
    setExtractedParagraphs([]);
    setCurrentStep(1);
    setPdfId(null);
    setTextEdited(false);
    setTextSaved(false);
    setCurrentPdfIndex(null);
  };

  // Función para contar ocurrencias de una palabra en un texto
  const countOccurrences = (text, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return (text.match(regex) || []).length;
  };

  // Función para descargar el JSON
  const downloadKeywordIndex = () => {
    try {
      // Crear el objeto con la estructura solicitada
      const indexData = {};

      // Primero recolectamos todas las palabras clave únicas
      const uniqueKeywords = new Set();
      extractedParagraphs.forEach(paragraph => {
        paragraph.keywords.forEach(keyword => {
          uniqueKeywords.add(keyword);
        });
      });

      // Convertir el Set a Array y ordenar alfabéticamente
      const sortedKeywords = Array.from(uniqueKeywords).sort();

      // Para cada palabra clave, buscar todos los párrafos donde aparece
      sortedKeywords.forEach(keyword => {
        indexData[keyword] = [];
        
        // Buscar esta palabra clave en todos los párrafos
        extractedParagraphs.forEach(paragraph => {
          if (paragraph.keywords.includes(keyword)) {
            // Obtener el nombre del PDF
            const pdfName = paragraph.pdfName || files.find(file => file.id === (paragraph.pdfId || currentPdfIndex))?.name || '';
            
            // Obtener la cita del archivo
            let citation = '';
            const file = files.find(file => file.name === pdfName);
            if (file) {
              // Usar la cita existente si está disponible
              citation = pdfCitations[file.id] || generateCitation(file.name);
              if (citation) {
                citation = `${citation}-p.${paragraph.number}`;
              }
            }

            // Añadir la información completa del párrafo al array de esta palabra clave
            indexData[keyword].push([
              structuralFormData.titulo || '',
              structuralFormData.subtitulo || '',
              structuralFormData.categoria1 || '',
              structuralFormData.categoria2 || '',
              structuralFormData.encabezado || '',
              citation,
              pdfName,
              paragraph.text
            ]);
          }
        });
      });

      // Convertir a string JSON con formato
      const jsonString = JSON.stringify(indexData, null, 2);
      
      // Crear blob y descargar
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keywords-${structuralFormData.titulo || 'index'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification('JSON descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error al generar el JSON:', error);
      showNotification('Error al generar el JSON', 'error');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const continueWithNextFile = () => {
    // Encontrar el siguiente archivo seleccionado que no ha sido procesado
    const nextFile = files.find(file => file.selected && !file.processed);
    
    if (nextFile) {
      processSelectedPDF(nextFile.id);
    } else {
      showNotification('Todos los archivos seleccionados han sido procesados', 'success');
    }
  };

  const removeFile = (id) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== id));
    setSelectedFiles(prevSelectedFiles => prevSelectedFiles.filter(file => file.id !== id));
    
    if (currentPdfIndex === id) {
      setCurrentPdfIndex(null);
      setRawText('');
      setEditedText('');
      setPdfId(null);
    }
  };

  // Agregar esta función para cambiar entre PDFs
  const switchToPdf = (id) => {
    const fileToSwitch = files.find(file => file.id === id);
    if (!fileToSwitch || !fileToSwitch.processed) return;
    
    // Si hay cambios sin guardar en el PDF actual
    if (textEdited && !textSaved) {
      const confirmSwitch = window.confirm('Tienes cambios sin guardar. ¿Deseas continuar sin guardarlos?');
      if (!confirmSwitch) return;
    }
    
    setLoading(true);
    
    // Usar el endpoint que ya está funcionando en tu backend
    // Asumiendo que tienes un endpoint para obtener datos de un PDF específico por ID
    try {
      // Como alternativa, podemos almacenar el texto de cada PDF procesado en el estado
      // para evitar hacer llamadas al backend innecesarias
      setPdfId(fileToSwitch.pdfId || id); // Usar el pdfId almacenado si existe
      setCurrentPdfIndex(id);
      
      // Si no tienes un endpoint para recuperar datos de PDFs ya procesados,
      // puedes modificar processSelectedPDF para guardar estos datos en el estado de files
      if (fileToSwitch.rawText && fileToSwitch.editedText) {
        setRawText(fileToSwitch.rawText);
        setEditedText(fileToSwitch.editedText);
        setTextEdited(false);
        setTextSaved(true);
        setLoading(false);
        showNotification(`Cambiado a ${fileToSwitch.name}`, 'success');
      } else {
        // Si no tienes los datos guardados, necesitarás reprocesar el archivo
        // Esto sería ineficiente, por lo que te recomiendo modificar processSelectedPDF
        // para guardar estos datos
        const formData = new FormData();
        formData.append('pdf', fileToSwitch.file);
        
        axios.post(`${API}/process-pdf`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        .then(response => {
          setRawText(response.data.rawText);
          setEditedText(response.data.rawText);
          setPdfId(response.data.pdfId);
          
          // Almacenar los datos en el estado de files para futuras referencias
          setFiles(prevFiles => 
            prevFiles.map(file => 
              file.id === id 
                ? { 
                  ...file, 
                  rawText: response.data.rawText, 
                  editedText: response.data.rawText,
                  pdfId: response.data.pdfId 
                } 
                : file
            )
          );
          
          showNotification(`Cambiado a ${fileToSwitch.name}`, 'success');
        })
        .catch(error => {
          console.error('Error loading PDF data:', error);
          showNotification(`Error al cargar datos de ${fileToSwitch.name}`, 'error');
        })
        .finally(() => {
          setLoading(false);
        });
      }
    } catch (error) {
      console.error('Error switching PDF:', error);
      showNotification(`Error al cambiar a ${fileToSwitch.name}`, 'error');
      setLoading(false);
    }
  };

  // Modificar la función toggleMultiExtractMode
  const toggleMultiExtractMode = async () => {
    const newMode = !multiExtractMode;
    setMultiExtractMode(newMode);
    
    // Si se activa el modo, procesamos automáticamente todos los PDFs seleccionados
    if (newMode) {
      // Inicializar el objeto para los números de párrafos
      const paragraphNumbersObj = {};
      
      // Verificar si hay PDFs seleccionados sin procesar
      const unprocessedSelectedFiles = files.filter(file => file.selected && !file.processed);
      
      if (unprocessedSelectedFiles.length > 0) {
        setLoading(true);
        showNotification(`Procesando ${unprocessedSelectedFiles.length} PDFs pendientes...`, 'info');
        
        // Procesar cada PDF pendiente
        for (const file of unprocessedSelectedFiles) {
          try {
            await processFileSilently(file.id);
            // Agregar el PDF procesado al objeto de números de párrafos
            paragraphNumbersObj[file.id] = '';
          } catch (error) {
            console.error(`Error processing PDF ${file.name}:`, error);
            // Continuar con el siguiente archivo si hay un error
          }
        }
        
        setLoading(false);
        showNotification('Todos los PDFs han sido procesados', 'success');
      }
      
      // Inicializar los números de párrafos para todos los PDFs procesados
      files.filter(file => file.processed).forEach(file => {
        paragraphNumbersObj[file.id] = '';
      });
      
      setPdfParagraphNumbers(paragraphNumbersObj);
    }
  };

  // Función auxiliar para procesar un archivo sin mostrar notificaciones individuales
  const processFileSilently = async (id) => {
    const fileToProcess = files.find(file => file.id === id);
    if (!fileToProcess) return;
    
    const formData = new FormData();
    formData.append('pdf', fileToProcess.file);

    const response = await axios.post(`${API}/process-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    // Actualizar el estado del archivo sin cambiar el PDF actual
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === id ? { 
          ...file, 
          processed: true,
          rawText: response.data.rawText,
          editedText: response.data.rawText,
          pdfId: response.data.pdfId
        } : file
      )
    );
    
    return response.data;
  };

  // Función para manejar cambios en los números de párrafos de cada PDF
  const handlePdfParagraphNumbersChange = (id, value) => {
    setPdfParagraphNumbers(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Modificar la función de extracción para manejar múltiples PDFs
  const extractMultiplePdfParagraphs = async () => {
    // Verificar que haya PDFs seleccionados con números de párrafos
    const pdfsToExtract = files.filter(file => 
      file.processed && pdfParagraphNumbers[file.id] && pdfParagraphNumbers[file.id].trim() !== ''
    );
    
    if (pdfsToExtract.length === 0) {
      showNotification('Debes especificar números de párrafos para al menos un PDF', 'error');
      return;
    }

    // Obtener los valores del formulario estructural
    const titulo = document.getElementById('titulo')?.value || '';
    const subtitulo = document.getElementById('subtitulo')?.value || '';
    const categoria1 = document.getElementById('categoria1')?.value || '';
    const categoria2 = document.getElementById('categoria2')?.value || '';
    const encabezado = document.getElementById('encabezado')?.value || '';

    // Guardar los valores en el estado
    setStructuralFormData({
      titulo,
      subtitulo,
      categoria1,
      categoria2,
      encabezado
    });
    
    setLoading(true);
    
    try {
      // Crear un array para almacenar todos los resultados
      const allExtractedParagraphs = [];
      
      // Procesar cada PDF
      for (const pdf of pdfsToExtract) {
        const numbersArray = pdfParagraphNumbers[pdf.id]
          .split(',')
          .map(num => num.trim())
          .filter(Boolean);
        
        if (numbersArray.length === 0) continue;
        
        const response = await axios.post(`${API}/extract-from-edited`, {
          pdfId: pdf.pdfId,
          paragraphNumbers: JSON.stringify(numbersArray.map(Number))
        });
        
        // Añadir la información del PDF a cada párrafo extraído
        const paragraphsWithPdfInfo = response.data.extractedParagraphs.map(paragraph => ({
          ...paragraph,
          pdfName: pdf.name,
          pdfId: pdf.pdfId
        }));
        
        // Añadir los párrafos al array completo
        allExtractedParagraphs.push(...paragraphsWithPdfInfo);
      }
      
      setExtractedParagraphs(allExtractedParagraphs);
      setCurrentStep(3);
      showNotification(`Se extrajeron ${allExtractedParagraphs.length} párrafos de ${pdfsToExtract.length} PDFs`, 'success');
    } catch (error) {
      console.error('Error extracting paragraphs from multiple PDFs:', error);
      showNotification('Error al extraer párrafos de múltiples PDFs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Función para detectar siglas y generar citas
  const generateCitation = (fileName) => {
    // Primero verificar si es una relatoría
    if (fileName.includes("Reporte")) {
      const match = fileName.match(/\d+/);
      if (match) {
        const docNumber = match[0];
        return `R-PE-${docNumber}`;
      }
    }
    

    // Si no es relatoría, verificar si es una observación
    for (const [sigla, numero] of Object.entries(siglas)) {
      if (fileName.includes(sigla)) {
        const match = fileName.match(/\d+/);
        if (match) {
          const docNumber = match[0];
          return `O-${numero}-${docNumber}`;
        }
      }
    }
    return null;
  };

  // Función para procesar las citas y extraer los números de párrafos
  const processCitations = (citationsText) => {
    // Activar el modo de extracción múltiple si no está activado
    if (!multiExtractMode) {
      setMultiExtractMode(true);
    }

    // Objeto para almacenar los párrafos por archivo
    const paragraphsByFile = {};
    
    // Expresión regular para encontrar citas tipo O-X-XX-p.Y o R-PE-X-p.Y
    const citationRegex = /(?:O-(\d+)-(\d+)-p\.(\d+)|R-PE-(\d+)-p\.(\d+))/g;
    let match;
    
    while ((match = citationRegex.exec(citationsText)) !== null) {
      if (match[1]) { // Es una observación
        const [_, comiteNum, docNum, parNum] = match;
        
        // Mapeo de números de comité a siglas
        const comiteMap = {
          '1': 'CCPR',
          '2': 'CESCR',
          '3': 'CERD',
          '4': 'CEDAW',
          '5': 'CAT',
          '6': 'CRC',
          '7': 'CMW',
          '8': 'CRDP',
          '9': 'CED'
        };
        
        const comite = comiteMap[comiteNum];
        if (!comite) continue;
        
        // Buscar el archivo correspondiente
        const matchingFile = files.find(file => 
          file.name.includes(`${comite}`) && file.name.includes(`${docNum}`)
        );
        
        if (matchingFile) {
          if (!paragraphsByFile[matchingFile.id]) {
            paragraphsByFile[matchingFile.id] = new Set();
          }
          paragraphsByFile[matchingFile.id].add(parseInt(parNum));

          // Procesar el archivo si no está procesado
          if (!matchingFile.processed) {
            processFileSilently(matchingFile.id);
          }
        }
      } else { // Es una relatoría
        const [_, __, ___, reportNum, parNum] = match;
        
        // Buscar el archivo correspondiente
        const matchingFile = files.find(file => 
          file.name.match(new RegExp(`Reporte temático ${reportNum}`, 'i'))
        );
        
        if (matchingFile) {
          if (!paragraphsByFile[matchingFile.id]) {
            paragraphsByFile[matchingFile.id] = new Set();
          }
          paragraphsByFile[matchingFile.id].add(parseInt(parNum));

          // Procesar el archivo si no está procesado
          if (!matchingFile.processed) {
            processFileSilently(matchingFile.id);
          }
        }
      }
    }
    
    // Actualizar los números de párrafos para cada archivo
    Object.entries(paragraphsByFile).forEach(([fileId, paragraphs]) => {
      const sortedParagraphs = Array.from(paragraphs).sort((a, b) => a - b);
      handlePdfParagraphNumbersChange(fileId, sortedParagraphs.join(', '));
    });

    // Actualizar el estado de pdfParagraphNumbers
    setPdfParagraphNumbers(prev => {
      const newState = { ...prev };
      Object.entries(paragraphsByFile).forEach(([fileId, paragraphs]) => {
        const sortedParagraphs = Array.from(paragraphs).sort((a, b) => a - b);
        newState[fileId] = sortedParagraphs.join(', ');
      });
      return newState;
    });
  };

  // Función para manejar cambios en el campo de citas
  const handleCitationsChange = (e) => {
    const citationsText = e.target.value;
    processCitations(citationsText);
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
          <div>Subir y Seleccionar PDFs</div>
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
          <div className="section-title">Sube tus archivos PDF</div>
          
          <div className="file-input-container">
            <div className="file-input-label">
              {files.length > 0 
                ? `${files.length} archivos seleccionados` 
                : "Haz clic aquí para seleccionar archivos PDF"}
            </div>
            <input 
              type="file" 
              accept=".pdf" 
              multiple 
              onChange={handleFileChange}
              ref={fileInputRef} 
            />
          </div>
          
          {files.length > 0 && (
            <div className="files-list-container">
              <div className="files-list-header">
                <div className="select-all-container">
                  <input 
                    type="checkbox" 
                    id="select-all" 
                    checked={files.length > 0 && files.every(file => file.selected)}
                    onChange={toggleSelectAll}
                  />
                  <label htmlFor="select-all">Seleccionar todos</label>
                </div>
                <div className="files-count">
                  {files.length} archivos, {files.filter(file => file.selected).length} seleccionados
                </div>
              </div>
              
              <div className="files-list">
                {files.map((file) => (
                  <div key={file.id} className={`file-item ${file.selected ? 'selected' : ''} ${file.processed ? 'processed' : ''}`}>
                    <div className="file-select">
                      <input 
                        type="checkbox" 
                        id={`file-${file.id}`} 
                        checked={file.selected}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </div>
                    <div className="file-info">
                      <label htmlFor={`file-${file.id}`} className="file-name">
                        {file.name}
                      </label>
                      {file.processed && <span className="file-processed">Procesado</span>}
                    </div>
                    <button 
                      className="btn-icon btn-remove"
                      onClick={() => removeFile(file.id)}
                      title="Eliminar archivo"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="upload-actions">
          <button 
            className={`btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
              onClick={processPDFs}
              disabled={loading || files.filter(file => file.selected).length === 0}
          >
              {loading ? 'Procesando...' : 'Procesar PDFs seleccionados'}
          </button>
          </div>
        </div>
      )}
      
      {currentStep === 2 && (
        <>
          <div className="app-section pdf-selector-section">
            <div className="section-title">PDFs disponibles</div>
            <div className="pdf-selector-scrollable">
              <div className="pdf-selector-container">
                {/* Mostrar todos los PDFs en el orden original */}
                {files.map(file => (
                  file.selected && (
                    <div 
                      key={file.id} 
                      className={`pdf-selector-item ${currentPdfIndex === file.id ? 'active' : ''} ${file.processed ? 'processed' : 'pending'} ${multiExtractMode && pdfParagraphNumbers[file.id]?.trim() ? 'has-paragraphs' : ''}`}
                      onClick={() => file.processed ? switchToPdf(file.id) : processSelectedPDF(file.id)}
                      title={file.processed ? file.name : `Procesar ${file.name}`}
                    >
                      <div className="pdf-selector-content">
                        <div className="pdf-selector-name">
                          {file.name}
                        </div>
                        {pdfCitations[file.id] && (
                          <div className="pdf-citation">{pdfCitations[file.id]}</div>
                        )}
                      </div>
                      <div className="pdf-selector-status">
                        {file.processed ? 'Procesado' : 'Por procesar'}
                      </div>
                      {currentPdfIndex === file.id && <div className="pdf-selector-indicator"></div>}
                    </div>
                  )
                ))}
              </div>
            </div>
            
            {/* Información sobre los PDFs */}
            <div className="pdf-status-info">
              <span>
                {files.filter(file => file.processed).length} de {files.filter(file => file.selected).length} PDFs procesados
              </span>
            </div>
          </div>
          
          {/* El resto del contenido para la edición del texto */}
          {currentPdfIndex ? (
        <>
          <div className="app-section text-edit-section">
                <div className="section-title">
                  Edita el texto procesado
                  {currentPdfIndex && (
                    <span className="current-file-name">
                      {files.find(file => file.id === currentPdfIndex)?.name}
                    </span>
                  )}
                </div>
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
              
              {/* Mover el toggle de extracción múltiple a su propia sección */}
              <div className="app-section multi-extract-toggle-section">
                <div className="multi-extract-toggle-container">
                  <div className="multi-extract-toggle">
                    <input
                      type="checkbox"
                      id="multi-extract-toggle"
                      checked={multiExtractMode}
                      onChange={toggleMultiExtractMode}
                    />
                    <label htmlFor="multi-extract-toggle">
                      Extraer párrafos de múltiples PDFs
                    </label>
                  </div>
                </div>
              </div>
          
          {/* Nuevo formulario de información estructural */}
          <div className="app-section structure-form-section">
            <div className="section-title">Información Estructural</div>
            <div className="structure-form">
              <div className="form-group">
                <label htmlFor="titulo">Título de la estructura:</label>
                <input
                  type="text"
                  id="titulo"
                  className="form-input"
                  placeholder="Ingrese el título"
                />
              </div>
              <div className="form-group">
                <label htmlFor="subtitulo">Subtítulo:</label>
                <input
                  type="text"
                  id="subtitulo"
                  className="form-input"
                  placeholder="Ingrese el subtítulo"
                />
              </div>
              <div className="form-group">
                <label htmlFor="categoria1">Categoría 1:</label>
                <input
                  type="text"
                  id="categoria1"
                  className="form-input"
                  placeholder="Ingrese la primera categoría"
                />
              </div>
              <div className="form-group">
                <label htmlFor="categoria2">Categoría 2:</label>
                <input
                  type="text"
                  id="categoria2"
                  className="form-input"
                  placeholder="Ingrese la segunda categoría"
                />
              </div>
              <div className="form-group">
                <label htmlFor="encabezado">Encabezado:</label>
                <input
                  type="text"
                  id="encabezado"
                  className="form-input"
                  placeholder="Ingrese el encabezado"
                />
              </div>
              <div className="form-group">
                <label htmlFor="citas">Citas:</label>
                <textarea
                  id="citas"
                  className="form-textarea"
                  placeholder="Ingrese las citas"
                  rows="4"
                  onChange={handleCitationsChange}
                />
                <button 
                  className="btn-ready"
                  onClick={() => {
                    const citasText = document.getElementById('citas')?.value || '';
                    if (!citasText.trim()) {
                      showNotification('Por favor ingrese al menos una cita', 'error');
                      return;
                    }
                    processCitations(citasText);
                    setMultiExtractMode(true);
                    showNotification('Párrafos mapeados exitosamente', 'success');
                  }}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
          
          <div className="app-section paragraph-section">
                {multiExtractMode ? (
                  // Modo extracción múltiple
                  <>
                    <div className="section-description">
                      Especifica los números de párrafos para cada PDF procesado que quieras extraer.
                    </div>
                    
                    <div className="multi-extract-container">
                      {loading ? (
                        <div className="multi-pdf-loading">
                          <div className="spinner"></div>
                          <p>Procesando PDFs pendientes...</p>
                        </div>
                      ) : (
                        <div className="multi-pdf-paragraphs">
                          {files.filter(file => file.processed).map(file => (
                            <div 
                              key={file.id} 
                              className={`multi-pdf-paragraph-item ${pdfParagraphNumbers[file.id]?.trim() ? 'has-paragraphs' : ''}`}
                            >
                              <div className="multi-pdf-name">{file.name}</div>
                              <div className="multi-pdf-input-container">
                                <input
                                  type="text"
                                  className="paragraph-input"
                                  placeholder="Ejemplo: 1, 2, 5, 10"
                                  value={pdfParagraphNumbers[file.id] || ''}
                                  onChange={(e) => handlePdfParagraphNumbersChange(file.id, e.target.value)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="multi-extract-footer">
                        <button 
                          className={`btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
                          onClick={extractMultiplePdfParagraphs}
                          disabled={loading || !files.some(file => 
                            file.processed && pdfParagraphNumbers[file.id] && pdfParagraphNumbers[file.id].trim() !== ''
                          )}
                        >
                          {loading ? 'Extrayendo...' : 'Extraer Párrafos Seleccionados de Archivos'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  // Modo normal - un solo PDF
                  <>
            <div className="section-description">
                      Ingresa los números de párrafos separados por comas (ej: 1, 3, 5) o usa el botón para extraer todos los párrafos
            </div>
            <div className="paragraph-input-container">
              <input
                type="text"
                className="paragraph-input"
                placeholder="Ejemplo: 1, 2, 5, 10"
                value={paragraphNumbers}
                onChange={handleParagraphNumbersChange}
              />
                      <div className="paragraph-actions">
              <button 
                className={`btn ${loading ? 'btn-disabled' : 'btn-primary'}`}
                onClick={extractParagraphs}
                          disabled={loading || !paragraphNumbers.trim()}
                        >
                          {loading ? 'Extrayendo...' : 'Extraer Párrafos Seleccionados'}
                        </button>
                        <button 
                          className={`btn ${loading ? 'btn-disabled' : 'btn-secondary'}`}
                          onClick={extractAllParagraphs}
                          disabled={loading}
                        >
                          {loading ? 'Extrayendo...' : 'Extraer Todos los Párrafos'}
              </button>
                      </div>
            </div>
            {textEdited && !textSaved && (
              <div className="warning-message">
                ⚠️ Guarda tus cambios antes de extraer párrafos
              </div>
            )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="app-section no-pdf-selected">
              <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <h3>Ningún PDF seleccionado</h3>
                <p>Selecciona un PDF procesado de la lista superior o procesa un nuevo PDF para comenzar.</p>
                {files.some(file => file.selected && !file.processed) && (
                  <button className="btn btn-primary" onClick={continueWithNextFile}>
                    Procesar siguiente PDF
                  </button>
                )}
              </div>
            </div>
          )}
          
          <div className="app-section action-buttons">
            <button className="btn btn-secondary" onClick={goToPreviousStep}>
              Volver a Selección de PDFs
            </button>
          </div>
        </>
      )}
      
      {currentStep === 3 && (
      <>
        <div className="app-section">
          <div className="section-title">Párrafos Extraídos</div>
            {/* Mostrar el nombre del archivo solo si NO estamos en modo de extracción múltiple */}
            {!multiExtractMode && (
              <div className="section-subtitle">
                Archivo: <span className="pdf-name">
                  {currentPdfIndex && files.find(file => file.id === currentPdfIndex)?.name}
                </span>
              </div>
            )}
            
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
            ) : (
              <>
                {extractedParagraphs.length > 0 ? (
                  <>
                    <div className="download-section">
                      <button 
                        className="btn btn-primary"
                        onClick={downloadKeywordIndex}
                      >
                        Descargar Índice de Palabras Clave (JSON)
                      </button>
                    </div>
            <div className="extracted-paragraphs">
              {extractedParagraphs.map((paragraph, index) => (
                <div key={index} className="paragraph-card">
                  <div className="paragraph-header">
                    {/* Si estamos en modo multi-extracción, siempre mostramos el nombre del PDF */}
                    {multiExtractMode && paragraph.pdfName && (
                      <div className="paragraph-pdf-name">PDF: {paragraph.pdfName}</div>
                    )}
                    <div className="paragraph-number">
                      {(() => {
                        const pdfName = paragraph.pdfName || files.find(file => file.id === (paragraph.pdfId || currentPdfIndex))?.name || '';
                        const file = files.find(file => file.name === pdfName);
                        if (file) {
                          const citation = pdfCitations[file.id] || generateCitation(file.name);
                          if (citation) {
                            return `${citation}-p.${paragraph.number}`;
                          }
                        }
                        return `Párrafo ${paragraph.number}`;
                      })()}
                    </div>
                  </div>
                  <div className="paragraph-content">
                    <div className="paragraph-text" dangerouslySetInnerHTML={{ __html: paragraph.text }} />
                    {paragraph.keywords && paragraph.keywords.length > 0 && (
                      <div className="paragraph-keywords">
                        <h4>Palabras clave:</h4>
                        <div className="keywords-container">
                          {paragraph.keywords.map((keyword, i) => (
                                    <span 
                                      key={i} 
                                      className="keyword-tag"
                                    >
                                      {keyword}
                                    </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
                  </>
          ) : (
            <div>No se encontraron párrafos. Intenta con otros números.</div>
                )}
              </>
          )}
        </div>
        
        <div className="app-section action-buttons">
          <button className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
            Volver a Editar
          </button>
            <div className="action-buttons-right">
              {files.some(file => file.selected && !file.processed) && (
                <button className="btn btn-primary" onClick={continueWithNextFile}>
                  Continuar con Siguiente PDF
                </button>
              )}
          <button className="btn btn-primary" onClick={resetApp}>
                Procesar Nuevos PDFs
          </button>
            </div>
        </div>
      </>
    )}
    </div>
  );
}

export default App;