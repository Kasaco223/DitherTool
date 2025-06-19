/**
 * Apply contrast adjustment to a value
 */
export function applyContrast(value, contrast) {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  return Math.max(0, Math.min(255, factor * (value - 128) + 128))
}

/**
 * Apply luminance-based adjustments (midtones, highlights)
 */
export function applyToneAdjustments(value, midtones, highlights) {
  const normalizedValue = value / 255
  
  // Apply midtones adjustment
  let adjusted = normalizedValue
  if (normalizedValue < 0.5) {
    adjusted = Math.pow(normalizedValue * 2, 2 - midtones / 50) / 2
  } else {
    adjusted = 1 - Math.pow((1 - normalizedValue) * 2, 2 - midtones / 50) / 2
  }
  
  // Aplicar highlights
  const highlightsFactor = highlights / 100;
  adjusted = adjusted * highlightsFactor + (1 - highlightsFactor);
  
  return Math.max(0, Math.min(255, adjusted * 255))
}

/**
 * Convert RGB to grayscale using luminance formula
 */
export function rgbToGrayscale(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  let h, s, v = max;

  let diff = max - min;
  s = max === 0 ? 0 : diff / max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, v * 100]; // H [0-360], S [0-100], V [0-100]
}

/**
 * Convert HSV to RGB
 */
export function hsvToRgb(h, s, v) {
  s /= 100;
  v /= 100;
  let i = Math.floor(h / 60);
  let f = h / 60 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  let r, g, b;

  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Aplica opacidad a toda la imagen antes de cualquier otro procesamiento
export function aplicarOpacidad(imageData, alpha) {
  if (typeof alpha !== 'number' || alpha >= 1) return imageData;
  const data = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = Math.round(data[i + 3] * alpha);
  }
  return new ImageData(data, imageData.width, imageData.height);
}
