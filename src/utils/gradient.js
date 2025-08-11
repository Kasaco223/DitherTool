import {
  applyContrast,
  rgbToGrayscale,
  applyToneAdjustments,
  hsvToRgb,
  aplicarOpacidad
} from './dithering';

// Helper for separable box blur to soften mask edges
function separableBoxBlur(data, width, height, radius) {
  const temp = new Float32Array(data.length);
  if (radius <= 0) return data;

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0;
      let count = 0;
      for (let kx = -radius; kx <= radius; kx++) {
        const nx = x + kx;
        if (nx >= 0 && nx < width) {
          total += data[y * width + nx];
          count++;
        }
      }
      temp[y * width + x] = total / count;
    }
  }

  const blurredData = new Float32Array(data.length);
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0;
      let count = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const ny = y + ky;
        if (ny >= 0 && ny < height) {
          total += temp[ny * width + x];
          count++;
        }
      }
      blurredData[y * width + x] = total / count;
    }
  }
  return blurredData;
}

/**
 * Genera un gradiente horizontal programático, ignorando la imagen importada.
 * El número de bandas depende de scale. Los demás sliders siguen modulando el gradiente.
 */
export function applyGradient(imageData, settings) {
  // Aplicar opacidad al imageData de entrada si es necesario (igual que otros filtros)
  let inputImageData = imageData;
  if (typeof settings.opacity === 'number' && settings.opacity < 100) {
    inputImageData = aplicarOpacidad(imageData, settings.opacity / 100);
  }
  const { width, height, data } = inputImageData;
  const newData = new Uint8ClampedArray(width * height * 4);
  const {
    luminanceThreshold = 50,
    scale = 1,
    smoothness = 0,
    contrast = 0,
    midtones = 50,
    highlights = 100,
    blur = 0,
    invert = false,
    invertShape = 0,
    useCustomColors = false,
    customNeonColors = { h: 300, s: 100, v: 100 }
  } = settings;

  // Determinar opacidad basada en colores personalizados
  let alpha = 255; // Por defecto opaco
  if (useCustomColors && customNeonColors && typeof customNeonColors.a === 'number') {
    alpha = Math.round(customNeonColors.a * 255);
  }

  // --- ZOOM SOLO EN EL PATRÓN DE BANDAS ---
  // scale: 1.0 = 1x (bandas normales), scale: 0.1 = 8x (bandas 8 veces más gruesas)
  const minZoom = 8;
  const maxZoom = 1;
  const zoom = minZoom + (maxZoom - minZoom) * ((scale - 0.1) / 0.9);

  // Calcular el área de la imagen original a mostrar (centrada)
  const cropWidth = Math.round(width / zoom);
  const cropHeight = Math.round(height / zoom);
  const cropX = Math.floor((width - cropWidth) / 2);
  const cropY = Math.floor((height - cropHeight) / 2);

  // Crear un buffer para la imagen recortada y escalada
  const zoomedData = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Coordenadas en la imagen original (área recortada)
      const srcX = cropX + Math.floor(x * cropWidth / width);
      const srcY = cropY + Math.floor(y * cropHeight / height);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * width + x) * 4;
      zoomedData[dstIdx] = data[srcIdx];
      zoomedData[dstIdx + 1] = data[srcIdx + 1];
      zoomedData[dstIdx + 2] = data[srcIdx + 2];
      zoomedData[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  // --- REDUCCIÓN DE CALIDAD (DOWNSCALE/UPSCALE) EN LA IMAGEN ORIGINAL SEGÚN SCALE (SUAVE) ---
  const minQuality = 20;
  const maxQuality = height;
  const exp = 2.5; // Controla la suavidad de la transición
  const t = Math.pow((scale - 0.1) / 0.9, exp);
  let quality;
  if (scale >= 0.999) {
    quality = height;
  } else {
    quality = Math.round(minQuality + (maxQuality - minQuality) * t);
  }

  // Crear un buffer de baja calidad (downscale y luego upscale)
  let lowQualityData;
  if (quality === height) {
    lowQualityData = data;
  } else {
    // Downscale
    const temp = new Uint8ClampedArray(width * quality * 4);
    for (let y = 0; y < quality; y++) {
      for (let x = 0; x < width; x++) {
        // Promediar los píxeles originales que caen en esta franja
        const yStart = Math.floor(y * height / quality);
        const yEnd = Math.floor((y + 1) * height / quality);
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let yy = yStart; yy < yEnd; yy++) {
          const idx = (yy * width + x) * 4;
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
          count++;
        }
        const idxTemp = (y * width + x) * 4;
        temp[idxTemp] = Math.round(sumR / count);
        temp[idxTemp + 1] = Math.round(sumG / count);
        temp[idxTemp + 2] = Math.round(sumB / count);
        temp[idxTemp + 3] = 255;
      }
    }
    // Upscale
    lowQualityData = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcY = Math.floor(y * quality / height);
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const idxSrc = (srcY * width + x) * 4;
        lowQualityData[idx] = temp[idxSrc];
        lowQualityData[idx + 1] = temp[idxSrc + 1];
        lowQualityData[idx + 2] = temp[idxSrc + 2];
        lowQualityData[idx + 3] = 255;
      }
    }
  }

  // Apply invertShape to the base image data first
  if (invertShape > 0) {
    const amount = invertShape / 100;
    for (let i = 0; i < lowQualityData.length; i += 4) {
      lowQualityData[i] = lowQualityData[i] + (255 - 2 * lowQualityData[i]) * amount; // Red
      lowQualityData[i + 1] = lowQualityData[i + 1] + (255 - 2 * lowQualityData[i + 1]) * amount; // Green
      lowQualityData[i + 2] = lowQualityData[i + 2] + (255 - 2 * lowQualityData[i + 2]) * amount; // Blue
    }
  }

  // Procesar la imagen de baja calidad en vez de la original
  const processed = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    let lum = rgbToGrayscale(lowQualityData[idx], lowQualityData[idx + 1], lowQualityData[idx + 2]);
    lum = applyContrast(lum, contrast);
    lum = applyToneAdjustments(lum, midtones, highlights);
    // Posterización (smoothness)
    if (smoothness > 0) {
      const levels = Math.max(2, Math.round(20 - (smoothness / 10) * 18));
      lum = Math.round((lum / 255) * (levels - 1)) / (levels - 1) * 255;
    }
    processed[i] = lum;
  }

  // Máscara binaria (con opción de invertir)
  const mask = new Uint8Array(width * height);
  const threshold = (luminanceThreshold / 100) * 255;
  let maskSum = 0;

  if (quality === height) {
    // Fuerza la máscara: mitad superior 1, mitad inferior 0
    for (let y = 0; y < height; y++) {
      const value = y < height / 2 ? 1 : 0;
      for (let x = 0; x < width; x++) {
        mask[y * width + x] = value;
        maskSum += value;
      }
    }
  } else {
    for (let i = 0; i < width * height; i++) {
      mask[i] = processed[i] < threshold ? 1 : 0;
      maskSum += mask[i];
    }
  }

  // Si la máscara es toda blanca o negra, forzar una banda central de degradado
  if (maskSum === 0 || maskSum === width * height) {
    const bandY = Math.floor(height / 2);
    for (let x = 0; x < width; x++) {
      mask[bandY * width + x] = 1;
    }
  }

  // Colores para el degradado
  let [r1, g1, b1] = [255, 255, 255]; // blanco
  let [r2, g2, b2] = useCustomColors ? hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v) : [0, 0, 0];

  // Aplicar invert a los colores si está activo
  if (invert) {
    r1 = 255 - r1;
    g1 = 255 - g1;
    b1 = 255 - b1;
    r2 = 255 - r2;
    g2 = 255 - g2;
    b2 = 255 - b2;
  }

  // El patrón de bandas se calcula en un espacio "virtual" escalado por zoom
  for (let row = 0; row < quality; row++) {
    // Banda virtual en el espacio "zoomed"
    const yStartVirtual = row * Math.ceil(height / quality);
    const yEndVirtual = Math.min((row + 1) * Math.ceil(height / quality), height);
    for (let y = 0; y < height; y++) {
      // Coordenada Y en el espacio virtual
      const yVirtual = Math.floor(y / zoom);
      if (yVirtual < yStartVirtual || yVirtual >= yEndVirtual) continue;

      // Detección de filas sin detalle (curvatura baja en todo el ancho)
      let hasDetail = false;
      for (let x = 1; x < width - 1; x++) {
        const a = processed[y * width + (x - 1)];
        const b = processed[y * width + x];
        const c = processed[y * width + (x + 1)];
        const curvature = Math.abs(c - 2 * b + a);
        if (curvature > 12) { hasDetail = true; break; }
      }

      // Conteo de transiciones (cruces con el umbral) a lo largo de la fila
      let transitions = 0;
      let prevInside = processed[y * width] < threshold;
      for (let x = 1; x < width; x++) {
        const insideX = processed[y * width + x] < threshold;
        if (insideX !== prevInside) {
          transitions++;
          prevInside = insideX;
        }
      }

      // Criterio de transparencia: filas sin detalle o con <= 1 transición
      if (!hasDetail || transitions <= 1) {
        for (let x = 0; x < width; x++) {
          const idxAlpha = (y * width + x) * 4 + 3;
          newData[idxAlpha] = 0;
        }
        continue;
      }

      // Si toda la fila cae en el mismo estado (todo < threshold o todo >= threshold)
      // hacemos transparente la fila completa para que se vea el fondo.
      let firstInside = processed[y * width] < threshold;
      let isUniformRow = true;
      for (let x = 1; x < width; x++) {
        const insideX = processed[y * width + x] < threshold;
        if (insideX !== firstInside) { isUniformRow = false; break; }
      }
      if (isUniformRow) {
        for (let x = 0; x < width; x++) {
          const idxAlpha = (y * width + x) * 4 + 3;
          newData[idxAlpha] = 0;
        }
        continue;
      }

      let inSegment = false;
      let segStart = 0;
      for (let x = 0; x <= width; x++) {
        // Usar la lógica de máscara original pero en el espacio virtual
        const idx = y * width + x;
        let lum = processed[idx];
        const inside = x < width && lum < threshold;
        if (inside && !inSegment) {
          inSegment = true;
          segStart = x;
        } else if ((!inside || x === width) && inSegment) {
          inSegment = false;
          // Pintar degradado de r1/g1/b1 a r2/g2/b2 en el segmento [segStart, x-1]
          const segLen = x - segStart;
          for (let sx = segStart; sx < x; sx++) {
            const idx4 = (y * width + sx) * 4;
            const t = segLen > 1 ? (sx - segStart) / (segLen - 1) : 0;
            newData[idx4] = Math.round(r1 * (1 - t) + r2 * t);
            newData[idx4 + 1] = Math.round(g1 * (1 - t) + g2 * t);
            newData[idx4 + 2] = Math.round(b1 * (1 - t) + b2 * t);
            newData[idx4 + 3] = alpha;
          }
        }
      }
      // Zonas blancas (fondo), degradado inverso
      inSegment = false;
      segStart = 0;
      for (let x = 0; x <= width; x++) {
        const idx = y * width + x;
        let lum = processed[idx];
        const isWhite = x < width && lum >= threshold;
        if (isWhite && !inSegment) {
          inSegment = true;
          segStart = x;
        } else if ((!isWhite || x === width) && inSegment) {
          inSegment = false;
          // Pintar degradado de r2/g2/b2 a r1/g1/b1 en el segmento blanco [segStart, x-1]
          const segLen = x - segStart;
          for (let sx = segStart; sx < x; sx++) {
            const idx4 = (y * width + sx) * 4;
            const t = segLen > 1 ? (sx - segStart) / (segLen - 1) : 0;
            newData[idx4] = Math.round(r2 * (1 - t) + r1 * t);
            newData[idx4 + 1] = Math.round(g2 * (1 - t) + g1 * t);
            newData[idx4 + 2] = Math.round(b2 * (1 - t) + b1 * t);
            newData[idx4 + 3] = alpha;
          }
        }
      }
    }
  }

  return new ImageData(newData, width, height);
} 