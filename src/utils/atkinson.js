import { hsvToRgb, rgbToGrayscale, applyContrast, applyToneAdjustments } from './dithering';

export function applyAtkinson(imageData, settings) {
  const {
    contrast,
    midtones,
    highlights,
    luminanceThreshold,
    invert,
    useCustomColors,
    customNeonColors,
    scale,
    smoothness,
    blur
  } = settings;

  // Determine the active neon color once per function call
  let activeNeonColor = null;
  if (useCustomColors) {
    if (customNeonColors && typeof customNeonColors.h === 'number' && typeof customNeonColors.s === 'number' && typeof customNeonColors.v === 'number') {
      activeNeonColor = customNeonColors;
    } else {
      // Fallback to a default neon color if custom colors are enabled but invalid
      activeNeonColor = { h: 300, s: 100, v: 100 }; // Default to Magenta Neón
    }
  }

  const data = new Uint8ClampedArray(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  // Apply scale by resizing the processing area
  const scaledWidth = Math.floor(width * scale);
  const scaledHeight = Math.floor(height * scale);

  let processedImageData;
  if (scale !== 1) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight);
    processedImageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  } else {
    processedImageData = imageData;
  }

  const processedData = new Uint8ClampedArray(processedImageData.data);
  const processedWidth = processedImageData.width;
  const processedHeight = processedImageData.height;

  const originalRgbForHue = new Uint8ClampedArray(processedWidth * processedHeight * 4);
  for (let i = 0; i < processedData.length; i++) {
    originalRgbForHue[i] = processedData[i];
  }

  // --- BLUR ---
  if (blur > 0) {
    const blurRadius = Math.ceil(blur);
    const tempData = new Uint8ClampedArray(processedData);
    for (let y = 0; y < processedHeight; y++) {
      for (let x = 0; x < processedWidth; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < processedHeight && nx >= 0 && nx < processedWidth) {
              const idx = (ny * processedWidth + nx) * 4;
              r += tempData[idx];
              g += tempData[idx + 1];
              b += tempData[idx + 2];
              count++;
            }
          }
        }
        const idx = (y * processedWidth + x) * 4;
        processedData[idx] = r / count;
        processedData[idx + 1] = g / count;
        processedData[idx + 2] = b / count;
      }
    }
  }

  const grayscaleData = new Float32Array(processedWidth * processedHeight);

  // Preprocesamiento: convertir a escala de grises y aplicar ajustes
  for (let i = 0; i < processedData.length; i += 4) {
    const r = processedData[i];
    const g = processedData[i + 1];
    const b = processedData[i + 2];

    let gray = rgbToGrayscale(r, g, b);
    gray = applyContrast(gray, contrast);
    if (luminanceThreshold !== 0) {
        gray = applyToneAdjustments(gray, midtones, highlights);
    }
    if (invert) gray = 255 - gray;

    grayscaleData[i / 4] = gray;
  }

  // --- SMOOTHNESS ---
  const errorFactor = 1 - (smoothness / 10);

  // Atkinson dithering
  const threshold = 255 - (luminanceThreshold / 100) * 255;

  for (let y = 0; y < processedHeight; y++) {
    for (let x = 0; x < processedWidth; x++) {
      const idx = y * processedWidth + x;
      const oldPixel = grayscaleData[idx];
      let newPixel;
      if (luminanceThreshold === 0) {
        newPixel = oldPixel > 240 ? 0 : 255;
      } else {
        newPixel = oldPixel < threshold ? 0 : 255;
      }
      const error = (oldPixel - newPixel) * errorFactor;
      grayscaleData[idx] = newPixel;
      if (x + 1 < processedWidth) grayscaleData[idx + 1] += error * 1 / 8;
      if (x + 2 < processedWidth) grayscaleData[idx + 2] += error * 1 / 8;
      if (y + 1 < processedHeight) {
        if (x - 1 >= 0) grayscaleData[idx + processedWidth - 1] += error * 1 / 8;
        grayscaleData[idx + processedWidth] += error * 1 / 8;
        if (x + 1 < processedWidth) grayscaleData[idx + processedWidth + 1] += error * 1 / 8;
      }
      if (y + 2 < processedHeight) grayscaleData[idx + 2 * processedWidth] += error * 1 / 8;
    }
  }

  // Convert back to RGBA with neon colors
  const resultData = new Uint8ClampedArray(processedImageData.data.length);
  for (let i = 0; i < grayscaleData.length; i++) {
    const grayValue = grayscaleData[i];
    const outputPixelIdx = i * 4;

    const isParticle = invert ? grayValue <= 128 : grayValue > 128;
    if (isParticle) {
      let r, g, b;

      if (activeNeonColor) {
        [r, g, b] = hsvToRgb(activeNeonColor.h, activeNeonColor.s, activeNeonColor.v);
        // Si el color es blanco puro, lo manejo como 255,255,254
        if (r === 255 && g === 255 && b === 255) {
          b = 254;
        }
      } else {
        r = 255; g = 255; b = 255;
      }

      // EXCEPCIÓN: Si el color custom es blanco puro y está invert, forzar negro puro
      const isWhite = (activeNeonColor && activeNeonColor.s === 0 && activeNeonColor.v === 100) || (r === 255 && g === 255 && b === 255);
      if (useCustomColors && invert && isWhite) {
        r = 0; g = 0; b = 0;
      } else if (useCustomColors && invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      resultData[outputPixelIdx] = r;
      resultData[outputPixelIdx + 1] = g;
      resultData[outputPixelIdx + 2] = b;
      if (useCustomColors && typeof customNeonColors.a === 'number') {
        resultData[outputPixelIdx + 3] = Math.round(customNeonColors.a * 255);
      } else {
        resultData[outputPixelIdx + 3] = 255; // Opaco si no es custom color
      }
    } else {
      if (useCustomColors && invert) {
        resultData[outputPixelIdx] = 0;
        resultData[outputPixelIdx + 1] = 0;
        resultData[outputPixelIdx + 2] = 0;
      } else {
        resultData[outputPixelIdx] = 0;
        resultData[outputPixelIdx + 1] = 0;
        resultData[outputPixelIdx + 2] = 0;
      }
      resultData[outputPixelIdx + 3] = 0; // Totalmente transparente
    }
  }

  // (Asegúrate de copiar todo el pipeline de color, opacidad y escalado si scale !== 1)

  // Scale back to original size if needed
  let finalImageData;
  if (scale !== 1) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = processedWidth;
    tempCanvas.height = processedHeight;
    tempCtx.putImageData(new ImageData(resultData, processedWidth, processedHeight), 0, 0);

    ctx.imageSmoothingEnabled = false; // Keep crisp pixels
    ctx.drawImage(tempCanvas, 0, 0, width, height);
    finalImageData = ctx.getImageData(0, 0, width, height);
  } else {
    finalImageData = new ImageData(resultData, width, height);
  }

  return finalImageData;
}

export default applyAtkinson; 