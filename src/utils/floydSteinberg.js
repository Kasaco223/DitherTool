import { aplicarOpacidad, hsvToRgb, rgbToGrayscale, applyContrast, applyToneAdjustments } from './dithering';

export function applyFloydSteinberg(imageData, settings) {
  const { 
    scale, 
    smoothness,
    contrast, 
    midtones, 
    highlights, 
    luminanceThreshold, 
    blur, 
    invert,
    invertShape = 0,
    useCustomColors,
    customNeonColors
  } = settings

  // --- APLICAR OPACIDAD ANTES DE TODO ---
  let preImageData = imageData;
  if (useCustomColors && customNeonColors && typeof customNeonColors.a === 'number' && customNeonColors.a < 1) {
    preImageData = aplicarOpacidad(imageData, customNeonColors.a);
  }

  const data = new Uint8ClampedArray(preImageData.data)
  const width = preImageData.width
  const height = preImageData.height

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

  // Apply scale by resizing the processing area
  const scaledWidth = Math.floor(width * scale)
  const scaledHeight = Math.floor(height * scale)
  
  // Create scaled canvas for processing if scale is not 1
  let processedImageData
  if (scale !== 1) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = scaledWidth
    canvas.height = scaledHeight
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCanvas.width = width
    tempCanvas.height = height
    tempCtx.putImageData(preImageData, 0, 0)
    
    // Scale the image
    ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight)
    processedImageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight)
  } else {
    processedImageData = preImageData
  }

  const processedData = new Uint8ClampedArray(processedImageData.data)
  const processedWidth = processedImageData.width
  const processedHeight = processedImageData.height

  // Store original RGB values for hue extraction (even if not used, to simplify logic flow)
  const originalRgbForHue = new Uint8ClampedArray(processedWidth * processedHeight * 4);
  for (let i = 0; i < processedData.length; i++) {
    originalRgbForHue[i] = processedData[i];
  }

  // Apply blur if specified (simple box blur)
  if (blur > 0) {
    const blurRadius = Math.ceil(blur)
    const tempData = new Uint8ClampedArray(processedData)
    
    for (let y = 0; y < processedHeight; y++) {
      for (let x = 0; x < processedWidth; x++) {
        let r = 0, g = 0, b = 0, count = 0
        
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            const ny = y + dy
            const nx = x + dx
            
            if (ny >= 0 && ny < processedHeight && nx >= 0 && nx < processedWidth) {
              const idx = (ny * processedWidth + nx) * 4
              r += tempData[idx]
              g += tempData[idx + 1]
              b += tempData[idx + 2]
              count++
            }
          }
        }
        
        const idx = (y * processedWidth + x) * 4
        processedData[idx] = r / count
        processedData[idx + 1] = g / count
        processedData[idx + 2] = b / count
      }
    }
  }

  // Apply invertShape (contrast inversion)
  if (invertShape > 0) {
    const amount = invertShape / 100;
    for (let i = 0; i < processedData.length; i += 4) {
      processedData[i] = processedData[i] + (255 - 2 * processedData[i]) * amount; // Red
      processedData[i + 1] = processedData[i + 1] + (255 - 2 * processedData[i + 1]) * amount; // Green
      processedData[i + 2] = processedData[i + 2] + (255 - 2 * processedData[i + 2]) * amount; // Blue
    }
  }

  // Convert to grayscale and apply adjustments
  const grayscaleData = new Float32Array(processedWidth * processedHeight)
  
  for (let i = 0; i < processedData.length; i += 4) {
    const r = processedData[i]
    const g = processedData[i + 1]
    const b = processedData[i + 2]
    
    // Convert to grayscale
    let gray = rgbToGrayscale(r, g, b)
    
    // Apply contrast
    gray = applyContrast(gray, contrast)
    
    // Apply tone adjustments ONLY if luminanceThreshold is not 0 (for default black background behavior)
    if (luminanceThreshold !== 0) {
        gray = applyToneAdjustments(gray, midtones, highlights)
    }
    
    // Apply invert
    if (invert) {
      gray = 255 - gray
    }
    
    grayscaleData[i / 4] = gray
  }

  // Apply Floyd-Steinberg dithering with smoothness
  // Using luminanceThreshold as the primary binarization threshold
  const threshold = 255 - (luminanceThreshold / 100) * 255; // Map 0-100 inverted to 0-255
  
  for (let y = 0; y < processedHeight; y++) {
    for (let x = 0; x < processedWidth; x++) {
      const idx = y * processedWidth + x
      const oldPixel = grayscaleData[idx]
      let newPixel;
      
      // Special binarization for luminanceThreshold 0: pixels brighter than 240 become black (background), others (<240) white (particles)
      if (luminanceThreshold === 0) {
        newPixel = oldPixel > 240 ? 0 : 255; // If very bright (>240), make black (background), else make white (particles)
      } else {
        newPixel = oldPixel < threshold ? 0 : 255; // Standard binarization: darker than threshold becomes black, brighter becomes white
      }
      const error = oldPixel - newPixel
      
      grayscaleData[idx] = newPixel
      
      // Distribute error to neighboring pixels with smoothness factor
      // Higher smoothness (0-10) should reduce error diffusion, leading to less noise and smoother transitions.
      // A smoothness of 0 means full error diffusion (most noisy), 10 means almost no diffusion (hard thresholding).
      const errorFactor = 1 - (smoothness / 10); // Adjust this factor: 0 when smoothness is 10, 1 when smoothness is 0
      
      if (x + 1 < processedWidth) {
        grayscaleData[idx + 1] += error * 7 / 16 * errorFactor
      }
      if (x - 1 >= 0 && y + 1 < processedHeight) {
        grayscaleData[idx + processedWidth - 1] += error * 3 / 16 * errorFactor
      }
      if (y + 1 < processedHeight) {
        grayscaleData[idx + processedWidth] += error * 5 / 16 * errorFactor
      }
      if (x + 1 < processedWidth && y + 1 < processedHeight) {
        grayscaleData[idx + processedWidth + 1] += error * 1 / 16 * errorFactor
      }
    }
  }

  // Scale back to original size if needed
  let finalImageData
  if (scale !== 1) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = width
    canvas.height = height
    
    // Create temporary canvas with processed data
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    tempCanvas.width = processedWidth
    tempCanvas.height = processedHeight
    
    // Convert processed grayscale data to colored ImageData
    const tempColoredData = new Uint8ClampedArray(processedWidth * processedHeight * 4)
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

        tempColoredData[outputPixelIdx] = r;
        tempColoredData[outputPixelIdx + 1] = g;
        tempColoredData[outputPixelIdx + 2] = b;
        tempColoredData[outputPixelIdx + 3] = 255; // Completamente opaco
      } else {
        if (useCustomColors && invert) {
          tempColoredData[outputPixelIdx] = 0;
          tempColoredData[outputPixelIdx + 1] = 0;
          tempColoredData[outputPixelIdx + 2] = 0;
      } else {
        tempColoredData[outputPixelIdx] = 0;
        tempColoredData[outputPixelIdx + 1] = 0;
        tempColoredData[outputPixelIdx + 2] = 0;
        }
        tempColoredData[outputPixelIdx + 3] = 0; // Totalmente transparente
      }
    }
    
    const tempImageData = new ImageData(tempColoredData, processedWidth, processedHeight)
    tempCtx.putImageData(tempImageData, 0, 0)
    
    // Scale back to original size
    ctx.imageSmoothingEnabled = false // Keep crisp pixels
    ctx.drawImage(tempCanvas, 0, 0, width, height)
    finalImageData = ctx.getImageData(0, 0, width, height)
    // --- Aplicar opacidad personalizada al final si corresponde ---
    if (useCustomColors && customNeonColors && typeof customNeonColors.a === 'number' && customNeonColors.a < 1) {
      const data = finalImageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i + 3] = Math.round(data[i + 3] * customNeonColors.a);
      }
    }
  } else {
    // Convert back to RGBA for original size with neon colors
    const resultData = new Uint8ClampedArray(preImageData.data.length)
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
          resultData[outputPixelIdx + 3] = 255;
        }
      } else {
        // Fondo siempre transparente, igual que stippling
        resultData[outputPixelIdx] = 0;
        resultData[outputPixelIdx + 1] = 0;
        resultData[outputPixelIdx + 2] = 0;
        resultData[outputPixelIdx + 3] = 0;
      }
    }
    finalImageData = new ImageData(resultData, width, height)
  }

  return finalImageData
}

export default applyFloydSteinberg; 