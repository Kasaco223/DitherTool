import * as aalib from 'aalib.js';

/**
 * Convierte un ImageData en arte ASCII usando aalib.js
 * @param {ImageData} imageData - Imagen de entrada
 * @param {Object} options - Opciones de configuración (ancho, alto, contraste, brillo, etc.)
 * @returns {Promise<string>} - HTML con el arte ASCII
 */
export function imageDataToAsciiHTML(imageData, options = {}) {
  // Validación de datos
  console.log('ascii.js imageData:', imageData);
  console.log('ascii.js imageData.data:', imageData?.data);
  console.log('ascii.js imageData.width:', imageData?.width, 'ascii.js imageData.height:', imageData?.height);
  if (!imageData || !imageData.data || !imageData.width || !imageData.height) {
    return Promise.reject(new Error('Datos de imagen inválidos para ASCII.'));
  }
  // Opciones por defecto
  const {
    width = 100,
    height = 40,
    contrast = 1,
    brightness = 0,
    charset = '@%#*+=-:. ', // Charset ASCII seguro por defecto
    colored = false,
    fontFamily = 'monospace',
    fontSize = 10,
    background = '#FFF',
    color = '#000',
    el = null // Elemento HTML donde renderizar (opcional)
  } = options;

  // Log para depuración
  console.log('aalib importado:', aalib);
  console.log('imageData recibido:', imageData);

  // Creamos un Observable a partir del ImageData
  return new Promise((resolve, reject) => {
    aalib.read.imageData.fromImageData(imageData)
      .map(aalib.filter.contrast(contrast))
      .map(aalib.filter.brightness(brightness))
      .map(aalib.aa({ width, height, colored, charset }))
      .map(aalib.render.html({
        el,
        fontFamily,
        fontSize: fontSize + 'px',
        charset,
        background,
        color
      }))
      .subscribe({
        next: (htmlElement) => {
          // Si el usuario no pasa un elemento, devolvemos el outerHTML
          resolve(htmlElement.outerHTML);
        },
        error: (err) => reject(err)
      });
  });
} 