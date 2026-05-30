import JSZip from 'jszip';

/**
 * Lee un archivo .pptx y extrae todo el texto de las diapositivas
 * de forma 100% local en el cliente.
 * @param {File} file Objeto File del input.
 * @returns {Promise<string>} Texto completo extraído.
 */
export const extractTextFromPptx = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let text = '';
    
    // Las diapositivas se guardan bajo ppt/slides/slide[Número].xml
    const slideFiles = Object.keys(zip.files).filter(name => 
      name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );
    
    // Ordenar diapositivas numéricamente
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.replace('ppt/slides/slide', '').replace('.xml', ''), 10);
      const numB = parseInt(b.replace('ppt/slides/slide', '').replace('.xml', ''), 10);
      return numA - numB;
    });

    for (const slideFile of slideFiles) {
      const xmlText = await zip.files[slideFile].async('text');
      
      // Buscar texto dentro de etiquetas <a:t>
      const matches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g);
      if (matches) {
        // Limpiar etiquetas y unir texto
        const slideText = matches
          .map(m => m.replace(/<\/?a:t>/g, ''))
          .join(' ');
        
        const slideNumber = slideFile.replace('ppt/slides/slide', '').replace('.xml', '');
        text += `[Diapositiva ${slideNumber}]: ${slideText}\n\n`;
      }
    }
    
    return text.trim();
  } catch (error) {
    console.error("Error al extraer texto de PPTX:", error);
    throw new Error("No se pudo leer el archivo PowerPoint. Asegúrate de que no esté dañado.");
  }
};
