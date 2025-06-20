import { applyContrast, rgbToGrayscale } from './dithering';

/**
 * Aplica un gradiente horizontal modulado por la luminancia de la imagen original.
 * Las zonas oscuras de la imagen tendrán menos gradiente, las claras más.
 * @param {ImageData} imageData - Los datos de la imagen original.
 * @param {number} contrast - Valor de contraste (slider existente).
 * @param {number} alpha - Valor de opacidad (slider existente, 0-1).
 * @returns {ImageData} - Nueva imagen con el gradiente aplicado.
 */
export function applyGradient(imageData, contrast = 0, alpha = 1) {
  const { width, height, data } = imageData;
  const newData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Gradiente horizontal puro
      let gradient = (x / (width - 1)) * 255;
      gradient = applyContrast(gradient, contrast);

      // Luminancia de la imagen original
      const lum = rgbToGrayscale(data[i], data[i + 1], data[i + 2]) / 255;

      // Modula el gradiente por la luminancia
      const value = gradient * lum;

      newData[i] = value;
      newData[i + 1] = value;
      newData[i + 2] = value;
      newData[i + 3] = Math.round(255 * alpha);
    }
  }
  return new ImageData(newData, width, height);
} 