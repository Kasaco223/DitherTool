import { rgbToGrayscale, applyContrast, applyToneAdjustments, hsvToRgb } from './dithering';

// Utilidad para blur rápido (box blur separable)
function applyBlurToImageData(imageData, blurRadius) {
  if (blurRadius <= 0) return imageData;
  const { width, height, data } = imageData;
  const blurredData = new Uint8ClampedArray(data);

  // Blur horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dx = -blurRadius; dx <= blurRadius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          const idx = (y * width + nx) * 4;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      blurredData[idx] = r / count;
      blurredData[idx + 1] = g / count;
      blurredData[idx + 2] = b / count;
    }
  }

  // Blur vertical
  const finalData = new Uint8ClampedArray(blurredData);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          const idx = (ny * width + x) * 4;
          r += blurredData[idx];
          g += blurredData[idx + 1];
          b += blurredData[idx + 2];
          count++;
        }
      }
      const idx = (y * width + x) * 4;
      finalData[idx] = r / count;
      finalData[idx + 1] = g / count;
      finalData[idx + 2] = b / count;
    }
  }
  return new ImageData(finalData, width, height);
}

export function applyStippling(imageData, settings) {
  const {
    contrast,
    midtones,
    highlights,
    luminanceThreshold,
    blur = 0,
    invert = false,
    useCustomColors,
    customNeonColors,
    scale = 1,
    smoothness = 0,
    invertShape = 0,
    isExporting = false, // Nuevo parámetro para controlar el fondo
  } = settings;

  let processedImageData = imageData;

  // 1. Blur
  if (blur > 0) {
    processedImageData = applyBlurToImageData(processedImageData, Math.ceil(blur));
  }

  // 2. Invert Shape (contraste) - SOLO afecta la imagen base
  const data = new Uint8ClampedArray(processedImageData.data);
  if (invertShape > 0) {
    const amount = invertShape / 100;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] + (255 - 2 * data[i]) * amount;
      data[i + 1] = data[i + 1] + (255 - 2 * data[i + 1]) * amount;
      data[i + 2] = data[i + 2] + (255 - 2 * data[i + 2]) * amount;
    }
  }

  const width = processedImageData.width;
  const height = processedImageData.height;

  // 3. Preprocesamiento: grayscale, contraste, tonos, smoothness
  // NOTA: invert NO debe afectar aquí para el cálculo de luminancia
  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    let gray = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
    gray = applyContrast(gray, contrast);
    gray = applyToneAdjustments(gray, midtones, highlights);
    if (smoothness > 0) {
      const levels = Math.max(2, Math.round(20 - (smoothness / 10) * 18));
      gray = Math.round((gray / 255) * (levels - 1)) / (levels - 1) * 255;
    }
    // NO aplicar invert aquí para el cálculo de luminancia
    grayscale[i / 4] = gray;
  }

  // 4. Color y fondo - AQUÍ es donde se aplica invert al color del filtro
  let drawColor = [255, 255, 255]; // Blanco por defecto
  
  // Fondo: transparente para exportación PNG, sólido para preview
  let backgroundColor;
  if (isExporting) {
    // Exportación: fondo transparente
    backgroundColor = [0, 0, 0, 0]; // Transparente por defecto
  } else {
    // Preview: fondo sólido para ver opacidad
    backgroundColor = [0, 0, 0, 255]; // Negro sólido por defecto
  }

  if (useCustomColors && customNeonColors) {
    let r, g, b;
    [r, g, b] = hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v);
    
    // Aplicar invert SOLO al color del filtro, no a la imagen base
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
      if (isExporting) {
        backgroundColor = [255, 255, 255, 0]; // Fondo blanco transparente para exportación
      } else {
        backgroundColor = [255, 255, 255, 255]; // Fondo blanco sólido para preview
      }
    }
    
    drawColor = [r, g, b];
  } else if (invert) {
    if (isExporting) {
      backgroundColor = [255, 255, 255, 0]; // Fondo blanco transparente para exportación
    } else {
      backgroundColor = [255, 255, 255, 255]; // Fondo blanco sólido para preview
    }
    drawColor = [0, 0, 0]; // Negro si invert está activo
  }

  // 5. Opacidad - Usar customNeonColors.a en lugar de settings.opacity
  let alpha = 255; // Por defecto opaco
  if (useCustomColors && customNeonColors && typeof customNeonColors.a === 'number') {
    alpha = Math.round(customNeonColors.a * 255);
  }

  // 6. Inicializar canvas de salida con el fondo apropiado
  const outData = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < outData.length; i += 4) {
    outData[i] = backgroundColor[0];
    outData[i + 1] = backgroundColor[1];
    outData[i + 2] = backgroundColor[2];
    outData[i + 3] = backgroundColor[3];
  }

  // 7. Parámetros de stippling
  const minLines = 10, maxLines = 120;
  const minDots = 10, maxDots = 120;
  const scaleFactor = Math.pow(scale, 1);
  const stipplingLines = Math.round(minLines + (maxLines - minLines) * scaleFactor);
  const stipplingDots = Math.round(minDots + (maxDots - minDots) * scaleFactor);
  
  // 8. Tamaño de esferas basado en scale (esferas más grandes cuando scale es menor)
  const minDotRadius = 0.1, maxDotRadius = 4;
  const dotScaleFactor = 1 / scaleFactor; // Invertir la relación
  const adjustedMinDotRadius = minDotRadius * dotScaleFactor;
  const adjustedMaxDotRadius = maxDotRadius * dotScaleFactor;

  // 9. Dibuja líneas verticales
  for (let lx = 0; lx < stipplingLines; lx++) {
    const x = Math.floor((lx + 0.5) * width / stipplingLines);
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      outData[idx] = drawColor[0];
      outData[idx + 1] = drawColor[1];
      outData[idx + 2] = drawColor[2];
      outData[idx + 3] = alpha;
    }
  }

  // 10. Dibuja puntos (círculos) sobre las líneas, radio depende de la oscuridad y scale
  for (let lx = 0; lx < stipplingLines; lx++) {
    const x = Math.floor((lx + 0.5) * width / stipplingLines);
    for (let ly = 0; ly < stipplingDots; ly++) {
      const y = Math.floor((ly + 0.5) * height / stipplingDots);
      const idx = y * width + x;
      const gray = grayscale[idx];
      const threshold = (luminanceThreshold / 100) * 255;
      if (gray > threshold) {
        const darkness = 1 - (gray / 255);
        const thisDotRadius = adjustedMinDotRadius + (adjustedMaxDotRadius - adjustedMinDotRadius) * darkness;
        for (let dy = -Math.ceil(thisDotRadius); dy <= Math.ceil(thisDotRadius); dy++) {
          for (let dx = -Math.ceil(thisDotRadius); dx <= Math.ceil(thisDotRadius); dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              if (dx * dx + dy * dy <= thisDotRadius * thisDotRadius) {
                const outIdx = (py * width + px) * 4;
                outData[outIdx] = drawColor[0];
                outData[outIdx + 1] = drawColor[1];
                outData[outIdx + 2] = drawColor[2];
                outData[outIdx + 3] = alpha;
              }
            }
          }
        }
      }
    }
  }

  return new ImageData(outData, width, height);
}

export default applyStippling; 