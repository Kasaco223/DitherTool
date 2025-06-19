import { rgbToGrayscale, applyContrast, applyToneAdjustments, hsvToRgb } from './dithering';

export function applyStippling(imageData, settings) {
  const {
    contrast,
    midtones,
    highlights,
    luminanceThreshold,
    blur,
    invert,
    useCustomColors,
    customNeonColors,
    scale = 1, // de 0.1 a 1
  } = settings;

  const width = imageData.width;
  const height = imageData.height;
  const data = new Uint8ClampedArray(imageData.data);

  // Ajustar cantidad de líneas y puntos según scale
  const minLines = 10, maxLines = 120;
  const minDots = 10, maxDots = 120;
  const scaleFactor = Math.pow(scale, 1);
  const stipplingLines = Math.round(minLines + (maxLines - minLines) * scaleFactor);
  const stipplingDots = Math.round(minDots + (maxDots - minDots) * scaleFactor);
  // Rango de radio de punto
  const minDotRadius = 0.1, maxDotRadius = 4;

  // Preprocesamiento: blur, contraste, etc. (opcional, aquí solo escala de grises y contraste)
  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    let gray = rgbToGrayscale(data[i], data[i + 1], data[i + 2]);
    gray = applyContrast(gray, contrast);
    if (luminanceThreshold !== 0) {
      gray = applyToneAdjustments(gray, midtones, highlights);
    }
    if (invert) gray = 255 - gray;
    grayscale[i / 4] = gray;
  }

  // Crear canvas de salida
  const outData = new Uint8ClampedArray(width * height * 4);
  // Fondo transparente (no se rellena, queda a=0 por defecto)

  // Color de los puntos y líneas (blanco por defecto, negro si invert, custom si está activado)
  let drawColor = invert ? [0, 0, 0] : [255, 255, 255];
  if (useCustomColors && customNeonColors) {
    drawColor = hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v);
  }

  // Dibuja líneas verticales
  for (let lx = 0; lx < stipplingLines; lx++) {
    const x = Math.floor((lx + 0.5) * width / stipplingLines);
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      outData[idx] = drawColor[0];
      outData[idx + 1] = drawColor[1];
      outData[idx + 2] = drawColor[2];
      outData[idx + 3] = 255;
    }
  }

  // Dibuja puntos (círculos) sobre las líneas, radio depende de la oscuridad
  for (let lx = 0; lx < stipplingLines; lx++) {
    const x = Math.floor((lx + 0.5) * width / stipplingLines);
    for (let ly = 0; ly < stipplingDots; ly++) {
      const y = Math.floor((ly + 0.5) * height / stipplingDots);
      const idx = y * width + x;
      const gray = grayscale[idx];
      const threshold = 255 - (luminanceThreshold / 100) * 255;
      if (gray < threshold) {
        // Radio proporcional a la oscuridad: más oscuro, mayor radio
        const darkness = 1 - (gray / 255); // 0 (claro) a 1 (oscuro)
        const thisDotRadius = minDotRadius + (maxDotRadius - minDotRadius) * darkness;
        for (let dy = -Math.ceil(thisDotRadius); dy <= Math.ceil(thisDotRadius); dy++) {
          for (let dx = -Math.ceil(thisDotRadius); dx <= Math.ceil(thisDotRadius); dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              if (dx*dx + dy*dy <= thisDotRadius*thisDotRadius) {
                const outIdx = (py * width + px) * 4;
                outData[outIdx] = drawColor[0];
                outData[outIdx + 1] = drawColor[1];
                outData[outIdx + 2] = drawColor[2];
                outData[outIdx + 3] = 255;
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