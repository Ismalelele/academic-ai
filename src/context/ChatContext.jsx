import { createContext, useContext, useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { askGroq } from '../utils/aiProcessor';

// Configuramos el Worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user } = useAuth();
  
  // State structure matching UI expectations:
  // { [subjectType]: { documents: [], messages: [] } }
  const [subjectData, setSubjectData] = useState({});
  const [foldersMap, setFoldersMap] = useState({}); // { subjectName: id_carpeta }
  const [conversationsMap, setConversationsMap] = useState({}); // { subjectName: id_conversacion }

  useEffect(() => {
    if (!user) {
      setSubjectData({
        global: { documents: [], messages: [{ sender: 'ai', text: '¡Hola! Soy tu asistente. Inicia sesión para guardar tus datos.' }] }
      });
      return;
    }

    const loadCloudData = async () => {
      // 1. Fetch Carpetas
      const { data: carpetas } = await supabase.from('carpetas').select('*').eq('id_usuario', user.id);
      const fMap = {};
      const newSubjectData = {
        global: { documents: [], messages: [{ sender: 'ai', text: '¡Hola! Soy tu asistente académico. Sube apuntes aquí para empezar a estudiar de forma global.' }] }
      };

      if (carpetas) {
        for (let c of carpetas) {
          fMap[c.nombre_carpeta] = c.id_carpeta;
          newSubjectData[c.nombre_carpeta] = { documents: [], messages: [] };
        }
      }

      // 2. Fetch Apuntes
      const { data: apuntes } = await supabase.from('apuntes').select('*').eq('id_usuario', user.id);
      if (apuntes && carpetas) {
        for (let a of apuntes) {
          const carpeta = carpetas.find(c => c.id_carpeta === a.id_carpeta);
          if (carpeta) {
            newSubjectData[carpeta.nombre_carpeta].documents.push({
              id: a.id_apunte,
              name: a.titulo_documento,
              text: a.texto_extraido,
              storagePath: a.storage_path,
              isParsing: false,
              selected: true
            });
          }
        }
      }

      // 3. Fetch Conversaciones
      const { data: conversaciones } = await supabase.from('conversaciones').select('*').eq('id_usuario', user.id);
      const cMap = {};
      if (conversaciones) {
        for (let c of conversaciones) {
          cMap[c.titulo_chat] = c.id_conversacion;
          if (!newSubjectData[c.titulo_chat]) {
            newSubjectData[c.titulo_chat] = { documents: [], messages: [] };
          }
        }
      }

      // 4. Fetch Historial Chat
      if (conversaciones && conversaciones.length > 0) {
        const convIds = conversaciones.map(c => c.id_conversacion);
        const { data: historial } = await supabase.from('historial_chat').select('*').in('id_conversacion', convIds).order('fecha_envio', { ascending: true });
        if (historial) {
          for (let h of historial) {
            const conv = conversaciones.find(c => c.id_conversacion === h.id_conversacion);
            if (conv) {
              newSubjectData[conv.titulo_chat].messages.push({
                id: h.id_mensaje,
                sender: h.rol_emisor === 'USUARIO' ? 'user' : 'ai',
                text: h.mensaje_text
              });
            }
          }
        }
      }

      setFoldersMap(fMap);
      setConversationsMap(cMap);
      setSubjectData(newSubjectData);
    };

    loadCloudData();
  }, [user]);

  const getSubjectData = (subjectType) => {
    if (subjectType === 'global') {
      let allDocs = [];
      Object.keys(subjectData).forEach(key => {
        if (key !== 'global' && subjectData[key]?.documents) {
          allDocs = [...allDocs, ...subjectData[key].documents];
        }
      });
      if (subjectData['global'] && subjectData['global'].documents) {
        allDocs = [...allDocs, ...subjectData['global'].documents];
      }
      return {
        documents: allDocs,
        messages: subjectData['global']?.messages || [{ sender: 'ai', text: '¡Hola! Soy tu asistente académico. Sube apuntes aquí para empezar a estudiar de forma global.' }]
      };
    }
    return subjectData[subjectType] || { documents: [], messages: [{ sender: 'ai', text: `¡Hola! Soy tu asistente para este ramo. Sube apuntes para que te pueda ayudar a estudiar.` }] };
  };

  const ensureFolderExists = async (subjectType) => {
    if (foldersMap[subjectType]) return foldersMap[subjectType];
    const { data, error } = await supabase.from('carpetas').insert([{ id_usuario: user.id, nombre_carpeta: subjectType }]).select().single();
    if (error) {
      console.error("Error creating folder:", error);
      throw new Error("DB Error (Carpetas): " + error.message);
    }
    if (data) {
      setFoldersMap(prev => ({ ...prev, [subjectType]: data.id_carpeta }));
      return data.id_carpeta;
    }
    return null;
  };

  const ensureConversationExists = async (subjectType) => {
    if (conversationsMap[subjectType]) return conversationsMap[subjectType];
    
    // Asegurarnos de que la carpeta existe primero para obtener su ID
    const folderId = await ensureFolderExists(subjectType);

    const { data, error } = await supabase.from('conversaciones').insert([{ 
      id_usuario: user.id, 
      titulo_chat: subjectType,
      id_carpeta: folderId
    }]).select().single();
    
    if (error) throw error;
    if (data) {
      setConversationsMap(prev => ({ ...prev, [subjectType]: data.id_conversacion }));
      return data.id_conversacion;
    }
    return null;
  };

  const uploadDocument = async (subjectType, file) => {
    if (!user) return;
    const tempId = Date.now().toString();
    
    // UI Feedback temporal
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
      // 1. Extraer texto
      let fullText = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        fullText = await file.text();
      } else if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        fullText = result.value;
      }

      // 2. Subir a Supabase Storage
      const sanitizedSubject = subjectType.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${user.id}/${sanitizedSubject}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('apuntes').upload(filePath, file);
      if (uploadError) throw new Error("Storage Error: " + uploadError.message);

      // 3. Guardar en PostgreSQL
      const folderId = await ensureFolderExists(subjectType);
      const { data: apunteDB, error: dbError } = await supabase.from('apuntes').insert([{
        id_usuario: user.id,
        id_carpeta: folderId,
        titulo_documento: file.name,
        texto_extraido: fullText,
        storage_path: filePath
      }]).select().single();

      if (dbError) throw new Error("DB Error (Apuntes): " + dbError.message);

      // 4. Actualizar Estado UI
      setSubjectData(prev => {
        const current = prev[subjectType];
        return {
          ...prev,
          [subjectType]: {
            ...current,
            documents: current.documents.map(doc => 
              doc.id === tempId ? { id: apunteDB.id_apunte, name: apunteDB.titulo_documento, text: fullText, storagePath: filePath, isParsing: false, selected: true } : doc
            )
          }
        };
      });

    } catch (error) {
      console.error("Error subiendo documento:", error);
      setSubjectData(prev => {
        const current = prev[subjectType];
        return {
          ...prev,
          [subjectType]: {
            ...current,
            documents: current.documents.map(doc => 
              doc.id === tempId ? { ...doc, isParsing: false, error: error.message || 'Error desconocido' } : doc
            )
          }
        };
      });
    }
  };

  const deleteDocument = async (subjectType, documentId) => {
    let actualSubject = subjectType;
    let docToDelete = null;

    if (subjectType === 'global') {
      for (const [subj, data] of Object.entries(subjectData)) {
        const doc = data.documents?.find(d => d.id === documentId);
        if (doc) {
          actualSubject = subj;
          docToDelete = doc;
          break;
        }
      }
    } else {
      docToDelete = subjectData[subjectType]?.documents.find(d => d.id === documentId);
    }

    if (!docToDelete) return;
    
    // UI Update
    setSubjectData(prev => {
      const current = prev[actualSubject] || { documents: [], messages: [] };
      return { ...prev, [actualSubject]: { ...current, documents: current.documents.filter(doc => doc.id !== documentId) } };
    });

    if (docToDelete?.storagePath) {
      await supabase.storage.from('apuntes').remove([docToDelete.storagePath]);
    }
    await supabase.from('apuntes').delete().eq('id_apunte', documentId).eq('id_usuario', user?.id);
  };

  const toggleDocumentSelection = (subjectType, documentId) => {
    let actualSubject = subjectType;

    if (subjectType === 'global') {
      for (const [subj, data] of Object.entries(subjectData)) {
        if (data.documents?.some(d => d.id === documentId)) {
          actualSubject = subj;
          break;
        }
      }
    }

    setSubjectData(prev => {
      const current = prev[actualSubject] || { documents: [], messages: [] };
      return {
        ...prev,
        [actualSubject]: {
          ...current,
          documents: current.documents.map(doc => 
            doc.id === documentId ? { ...doc, selected: doc.selected === undefined ? false : !doc.selected } : doc
          )
        }
      };
    });
  };

  const renameDocument = async (subjectType, documentId, newName) => {
    let actualSubject = subjectType;

    if (subjectType === 'global') {
      for (const [subj, data] of Object.entries(subjectData)) {
        if (data.documents?.some(d => d.id === documentId)) {
          actualSubject = subj;
          break;
        }
      }
    }

    setSubjectData(prev => {
      const current = prev[actualSubject] || { documents: [], messages: [] };
      return {
        ...prev,
        [actualSubject]: {
          ...current,
          documents: current.documents.map(doc => doc.id === documentId ? { ...doc, name: newName } : doc)
        }
      };
    });
    await supabase.from('apuntes').update({ titulo_documento: newName }).eq('id_apunte', documentId).eq('id_usuario', user?.id);
  };

  const clearDocuments = async (subjectType) => {
    const docs = subjectData[subjectType]?.documents || [];
    setSubjectData(prev => {
      const current = prev[subjectType] || { documents: [], messages: [] };
      return { ...prev, [subjectType]: { ...current, documents: [] } };
    });
    
    for (let doc of docs) {
      if (doc.storagePath) await supabase.storage.from('apuntes').remove([doc.storagePath]);
      await supabase.from('apuntes').delete().eq('id_apunte', doc.id);
    }
  };

  const sendMessage = async (subjectType, text) => {
    if (!user) return;
    try {
      const convId = await ensureConversationExists(subjectType);

      // 1. Añadir y guardar mensaje de usuario
      const { data: userMsg, error: userMsgError } = await supabase.from('historial_chat').insert([{
        id_conversacion: convId,
        rol_emisor: 'USUARIO',
        mensaje_text: text
      }]).select().single();

      if (userMsgError) throw new Error("DB Error (Historial): " + userMsgError.message);

      setSubjectData(prev => {
        const current = prev[subjectType] || { documents: [], messages: [] };
        return {
          ...prev,
          [subjectType]: {
            ...current,
            messages: [...current.messages, { id: userMsg ? userMsg.id_mensaje : Date.now(), sender: 'user', text }]
          }
        };
      });

      const allDocs = getSubjectData(subjectType).documents;
      const currentDocs = allDocs.filter(doc => doc.selected !== false);
      
      if (allDocs.length === 0 || currentDocs.length === 0) {
        const fallbackText = allDocs.length === 0 
          ? "Aún no has subido documentos a esta asignatura." 
          : "No has seleccionado ningún documento para buscar.";
          
        const { data: sysMsg } = await supabase.from('historial_chat').insert([{ id_conversacion: convId, rol_emisor: 'SISTEMA', mensaje_text: fallbackText }]).select().single();
        
        setSubjectData(prev => {
          const current = prev[subjectType];
          return { ...prev, [subjectType]: { ...current, messages: [...current.messages, { id: sysMsg ? sysMsg.id_mensaje : Date.now()+1, sender: 'ai', text: fallbackText }] } };
        });
        return;
      }

      let contextText = currentDocs.map(doc => doc.text).join('\n---\n');
      if (!contextText.trim()) return;

      // Evitar exceder el límite de tokens gratuitos de Groq (~6000 tokens por MINUTO)
      // Reducimos a 8000 caracteres (~2000 tokens) para permitir varias preguntas por minuto sin saturar la API
      const MAX_CHARS = 8000;
      if (contextText.length > MAX_CHARS) {
        contextText = contextText.substring(0, MAX_CHARS) + "\n\n... [Texto truncado por límite de memoria de la API gratuita]";
      }

      // 2. Llamada real a Groq (Llama 3)
      const unselectedDocs = allDocs.filter(doc => doc.selected === false).map(doc => doc.name);
      const aiResponse = await askGroq(text, contextText, unselectedDocs);

      // 3. Guardar respuesta de IA
      const { data: aiMsg, error: aiMsgError } = await supabase.from('historial_chat').insert([{
        id_conversacion: convId,
        rol_emisor: 'SISTEMA',
        mensaje_text: aiResponse
      }]).select().single();

      if (aiMsgError) throw new Error("DB Error (Historial AI): " + aiMsgError.message);

      setSubjectData(prev => {
        const current = prev[subjectType];
        return {
          ...prev,
          [subjectType]: {
            ...current,
            messages: [...current.messages, { id: aiMsg ? aiMsg.id_mensaje : Date.now()+2, sender: 'ai', text: aiResponse }]
          }
        };
      });
    } catch (error) {
      console.error("Error en sendMessage:", error);
      alert("Error al enviar el mensaje: " + error.message);
    }
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
