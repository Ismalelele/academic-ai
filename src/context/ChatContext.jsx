import { createContext, useContext, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { askGroq } from '../utils/aiProcessor';

// Configuramos el Worker de PDF.js apuntando a unpkg con la versión .mjs requerida por pdfjs-dist v5
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const ChatContext = createContext();

export function ChatProvider({ children }) {
  // Structure: { [subjectType]: { documents: [], messages: [] } }
  const [subjectData, setSubjectData] = useState({
    global: {
      documents: [],
      messages: [{ sender: 'ai', text: '¡Hola! Soy tu asistente académico. Sube apuntes aquí para empezar a estudiar de forma global.' }]
    }
  });

  const getSubjectData = (subjectType) => {
    return subjectData[subjectType] || { documents: [], messages: [{ sender: 'ai', text: `¡Hola! Soy tu asistente para este ramo. Sube apuntes para que te pueda ayudar a estudiar.` }] };
  };

  const uploadDocument = async (subjectType, file) => {
    const tempId = Date.now();
    
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          documents: [...current.documents, { id: tempId, name: file.name, size: file.size, text: null, isParsing: true, selected: true }]
        }
      };
    });

    try {
      let fullText = '';
      
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        fullText = await file.text();
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fullText = result.value;
      } else {
        fullText = "El archivo no es compatible. Por favor sube solo PDF, TXT o DOCX.";
      }

      setSubjectData(prev => {
        const current = prev[subjectType];
        return {
          ...prev,
          [subjectType]: {
            ...current,
            documents: current.documents.map(doc => 
              doc.id === tempId ? { ...doc, text: fullText, isParsing: false } : doc
            )
          }
        };
      });
      
      console.log(`Documento "${file.name}" procesado. ${fullText.length} caracteres extraídos.`);
    } catch (error) {
      console.error("Error extrayendo texto del documento:", error);
      setSubjectData(prev => {
        const current = prev[subjectType];
        return {
          ...prev,
          [subjectType]: {
            ...current,
            documents: current.documents.map(doc => 
              doc.id === tempId ? { ...doc, isParsing: false, error: true } : doc
            )
          }
        };
      });
    }
  };

  const deleteDocument = (subjectType, documentId) => {
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          documents: current.documents.filter(doc => doc.id !== documentId)
        }
      };
    });
  };

  const toggleDocumentSelection = (subjectType, documentId) => {
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          documents: current.documents.map(doc => 
            doc.id === documentId ? { ...doc, selected: doc.selected === undefined ? false : !doc.selected } : doc
          )
        }
      };
    });
  };

  const renameDocument = (subjectType, documentId, newName) => {
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          documents: current.documents.map(doc => 
            doc.id === documentId ? { ...doc, name: newName } : doc
          )
        }
      };
    });
  };

  const clearDocuments = (subjectType) => {
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          documents: []
        }
      };
    });
  };

  const sendMessage = async (subjectType, text) => {
    // Añadir mensaje del usuario de inmediato
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return {
        ...prev,
        [subjectType]: {
          ...current,
          messages: [...current.messages, { id: Date.now(), sender: 'user', text }]
        }
      };
    });

    const allDocs = subjectData[subjectType]?.documents || [];
    const currentDocs = allDocs.filter(doc => doc.selected !== false);
    
    if (allDocs.length === 0) {
      setTimeout(() => {
        setSubjectData(prev => {
          const current = prev[subjectType];
          return {
            ...prev,
            [subjectType]: {
              ...current,
              messages: [...current.messages, { id: Date.now() + 1, sender: 'ai', text: "Aún no has subido documentos a esta asignatura. Por favor, sube material para que pueda buscar las respuestas exactas." }]
            }
          };
        });
      }, 1000);
      return;
    }

    if (currentDocs.length === 0) {
      setTimeout(() => {
        setSubjectData(prev => {
          const current = prev[subjectType];
          return {
            ...prev,
            [subjectType]: {
              ...current,
              messages: [...current.messages, { id: Date.now() + 1, sender: 'ai', text: "Tienes documentos subidos, pero no has seleccionado ninguno. Por favor marca las casillas de los apuntes que quieres que lea." }]
            }
          };
        });
      }, 1000);
      return;
    }

    // Esperar a que los textos de los PDFs estén listos (en caso de que se siga extrayendo)
    const contextText = currentDocs.map(doc => doc.text).join('\n---\n');
    
    if (!contextText.trim()) {
       setTimeout(() => {
        setSubjectData(prev => {
          const current = prev[subjectType];
          return {
            ...prev,
            [subjectType]: {
              ...current,
              messages: [...current.messages, { id: Date.now() + 1, sender: 'ai', text: "Estoy terminando de leer el PDF, por favor espera un momento e intenta de nuevo." }]
            }
          };
        });
      }, 1000);
      return;
    }

    // Llamada real a Groq (Llama 3)
    const unselectedDocs = allDocs.filter(doc => doc.selected === false).map(doc => doc.name);
    const aiResponse = await askGroq(text, contextText, unselectedDocs);

    setSubjectData(prev => {
      const current = prev[subjectType];
      return {
        ...prev,
        [subjectType]: {
          ...current,
          messages: [...current.messages, { id: Date.now() + 2, sender: 'ai', text: aiResponse }]
        }
      };
    });
  };

  return (
    <ChatContext.Provider value={{ subjectData, getSubjectData, uploadDocument, sendMessage, deleteDocument, clearDocuments, toggleDocumentSelection, renameDocument }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
