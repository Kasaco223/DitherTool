import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { applyAtkinson } from '../utils/atkinson'
import { applySmoothDiffuse } from '../utils/smoothDiffuse'
import { applyFloydSteinberg } from '../utils/floydSteinberg'
import { applyStippling } from '../utils/stippling'
import { applyGradient } from '../utils/gradient'
import { imageDataToAsciiHTML } from '../utils/ascii'

// Debounce hook for performance optimization
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Cache for pre-rendered dot patterns to optimize drawing
const dotCache = new Map();

function getDotPattern(size, color) {
  const key = `${size}-${color}`;
  if (dotCache.has(key)) {
    return dotCache.get(key);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Ensure the circle fills the 1x1 pixel when size is 1 for visibility
  const radius = size === 1 ? 0.5 : size / 2 * 0.8; 
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2, true); 
  ctx.fill();

  const imageData = ctx.getImageData(0, 0, size, size);
  dotCache.set(key, imageData);
  return imageData;
}

// Preprocesamiento para ASCII: blur + smoothness + highlights + luminanceThreshold
function preprocessImageForAscii(imageData, { blur = 0, smoothness = 0, highlights = 0, luminanceThreshold = 0 }) {
  const { width, height, data } = imageData;
  let processed = new Uint8ClampedArray(data);

  // BLUR (box blur simple)
  if (blur > 0) {
    const blurRadius = Math.ceil(blur);
    // Blur horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            const idx = (y * width + nx) * 4;
            r += processed[idx];
            g += processed[idx + 1];
            b += processed[idx + 2];
            count++;
          }
        }
        const idx = (y * width + x) * 4;
        processed[idx] = r / count;
        processed[idx + 1] = g / count;
        processed[idx + 2] = b / count;
      }
    }
    // Blur vertical
    const temp = new Uint8ClampedArray(processed);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            const idx = (ny * width + x) * 4;
            r += temp[idx];
            g += temp[idx + 1];
            b += temp[idx + 2];
            count++;
          }
        }
        const idx = (y * width + x) * 4;
        processed[idx] = r / count;
        processed[idx + 1] = g / count;
        processed[idx + 2] = b / count;
      }
    }
  }

  // SMOOTHNESS (posterización)
  if (smoothness > 0) {
    const levels = Math.max(2, Math.round(20 - (smoothness / 10) * 18));
    for (let i = 0; i < processed.length; i += 4) {
      let gray = 0.299 * processed[i] + 0.587 * processed[i + 1] + 0.114 * processed[i + 2];
      gray = Math.round((gray / 255) * (levels - 1)) / (levels - 1) * 255;
      processed[i] = processed[i + 1] = processed[i + 2] = gray;
    }
  }

  // HIGHLIGHTS (ajuste de brillo en áreas claras)
  if (highlights !== 0) {
    for (let i = 0; i < processed.length; i += 4) {
      const luminance = 0.299 * processed[i] + 0.587 * processed[i + 1] + 0.114 * processed[i + 2];
      if (luminance > 128) { // Solo áreas claras
        const factor = 1 + (highlights / 100);
        processed[i] = Math.min(255, processed[i] * factor);
        processed[i + 1] = Math.min(255, processed[i + 1] * factor);
        processed[i + 2] = Math.min(255, processed[i + 2] * factor);
      }
    }
  }

  // LUMINANCE THRESHOLD (umbral de luminancia)
  if (luminanceThreshold > 0) {
    const threshold = luminanceThreshold / 100;
    for (let i = 0; i < processed.length; i += 4) {
      const luminance = 0.299 * processed[i] + 0.587 * processed[i + 1] + 0.114 * processed[i + 2];
      const normalizedLuminance = luminance / 255;
      
      if (normalizedLuminance > threshold) {
        // Áreas por encima del umbral se vuelven más claras
        const factor = 1 + (normalizedLuminance - threshold) * 2;
        processed[i] = Math.min(255, processed[i] * factor);
        processed[i + 1] = Math.min(255, processed[i + 1] * factor);
        processed[i + 2] = Math.min(255, processed[i + 2] * factor);
      } else {
        // Áreas por debajo del umbral se vuelven más oscuras
        const factor = normalizedLuminance / threshold;
        processed[i] = processed[i] * factor;
        processed[i + 1] = processed[i + 1] * factor;
        processed[i + 2] = processed[i + 2] * factor;
      }
    }
  }

  return new ImageData(processed, width, height);
}

function getAsciiFontColor({ useCustomColors, customNeonColors, invert, opacity = 1 }) {
  let r = 255, g = 255, b = 255, a = opacity;
  if (useCustomColors && customNeonColors) {
    // HSV a RGB
    function hsvToRgb(h, s, v) {
      s /= 100; v /= 100;
      let c = v * s;
      let x = c * (1 - Math.abs((h / 60) % 2 - 1));
      let m = v - c;
      let r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; b = 0; }
      else if (h < 120) { r = x; g = c; b = 0; }
      else if (h < 180) { r = 0; g = c; b = x; }
      else if (h < 240) { r = 0; g = x; b = c; }
      else if (h < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      r = Math.round((r + m) * 255);
      g = Math.round((g + m) * 255);
      b = Math.round((b + m) * 255);
      return [r, g, b];
    }
    [r, g, b] = hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v);
    a = typeof customNeonColors.a === 'number' ? customNeonColors.a : opacity;
  }
  if (invert) {
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
  }
  return `rgba(${r},${g},${b},${a})`;
}

const CanvasPreview = forwardRef(({
  image,
  settings,
  zoom,
  canvasSize,
  useCustomColors,
  customNeonColors,
  offset,
  setOffset,
  invert
}, ref) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

  // Estado para pan
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // ✅ Expose canvas DOM to parent
  useImperativeHandle(ref, () => canvasRef.current)

  const debouncedSettings = { ...settings, useCustomColors, customNeonColors };

  const [asciiHTML, setAsciiHTML] = React.useState(null);

  // Definir minN, maxN y charSize fuera del useEffect para uso global
  const minN = 20;
  const maxN = 200;
  const scale = typeof debouncedSettings.scale === 'number' ? debouncedSettings.scale : 1.0;
  const N = Math.round(minN + (1.0 - scale) * (maxN - minN));
  const charSize = N;

  React.useEffect(() => {
    if (!image) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (debouncedSettings.style === 'ASCII') {
      setAsciiHTML(null);
      // Procesar la imagen base según los sliders antes de pasar a ASCII
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Invertir colores si invertShape > 0
      if (debouncedSettings.invertShape > 0) {
        const data = imageData.data;
        const amount = debouncedSettings.invertShape / 100;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] + (255 - 2 * data[i]) * amount; // Red
          data[i + 1] = data[i + 1] + (255 - 2 * data[i + 1]) * amount; // Green
          data[i + 2] = data[i + 2] + (255 - 2 * data[i + 2]) * amount; // Blue
        }
      }
      // PREPROCESAMIENTO: blur + smoothness
      const preprocessedImageData = preprocessImageForAscii(imageData, {
        blur: debouncedSettings.blur,
        smoothness: debouncedSettings.smoothness,
        highlights: debouncedSettings.highlights,
        luminanceThreshold: debouncedSettings.luminanceThreshold
      });
      // Determinar color personalizado si useCustomColors está activo
      const asciiColor = getAsciiFontColor({
        useCustomColors: debouncedSettings.useCustomColors,
        customNeonColors: debouncedSettings.customNeonColors,
        invert: debouncedSettings.invert,
        opacity: (debouncedSettings.useCustomColors && debouncedSettings.customNeonColors && typeof debouncedSettings.customNeonColors.a === 'number')
          ? debouncedSettings.customNeonColors.a
          : 1
      });
      const columns = Math.floor(image.width / N);
      const rows = Math.floor(image.height / N);
      imageDataToAsciiHTML(preprocessedImageData, {
        width: columns,
        height: rows,
        contrast: 1 + debouncedSettings.contrast / 100,
        brightness: debouncedSettings.midtones / 50 - 1,
        colored: false,
        fontSize: charSize,
        fontFamily: 'monospace',
        lineHeight: 0.6,
        background: debouncedSettings.invert ? '#fff' : '#000',
        color: asciiColor,
      })
        .then(html => setAsciiHTML(html))
        .catch(() => setAsciiHTML('<pre style="color:red">Error generando ASCII</pre>'));
      return;
    } else {
      setAsciiHTML(null); // Limpiar arte ASCII al cambiar de filtro
    }
    // Filtros normales
    let processedImageData;
    switch (debouncedSettings.style) {
      case 'Gradient':
        processedImageData = applyGradient(imageData, debouncedSettings);
        break;
      case 'Atkinson':
        processedImageData = applyAtkinson(imageData, debouncedSettings)
        break
      case 'Smooth Diffuse':
        processedImageData = applySmoothDiffuse(imageData, debouncedSettings)
        break
      case 'Stippling':
        processedImageData = applyStippling(imageData, debouncedSettings)
        break
      case 'Floyd-Steinberg':
      default:
        processedImageData = applyFloydSteinberg(imageData, debouncedSettings)
        break
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Fondo blanco para preview de Atkinson, Floyd-Steinberg o Stippling con invert activo
    if ((debouncedSettings.style === 'Atkinson' || debouncedSettings.style === 'Floyd-Steinberg' || debouncedSettings.style === 'Stippling') && debouncedSettings.invert && !debouncedSettings.isExporting) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.putImageData(processedImageData, 0, 0);
  }, [image, settings, useCustomColors, customNeonColors])

  React.useEffect(() => {
    console.log('asciiHTML actualizado:', asciiHTML);
  }, [asciiHTML]);

  // Limpiar arte ASCII cuando la imagen cambia
  React.useEffect(() => {
    setAsciiHTML(null);
  }, [image]);

  // Recalcular arte ASCII inmediatamente al cambiar cualquier slider relevante
  React.useEffect(() => {
    if (debouncedSettings.style === 'ASCII' && image) {
      setAsciiHTML(null);
      // Procesar la imagen base según los sliders antes de pasar a ASCII
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Invertir colores si invertShape > 0
      if (debouncedSettings.invertShape > 0) {
        const data = imageData.data;
        const amount = debouncedSettings.invertShape / 100;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i] + (255 - 2 * data[i]) * amount; // Red
          data[i + 1] = data[i + 1] + (255 - 2 * data[i + 1]) * amount; // Green
          data[i + 2] = data[i + 2] + (255 - 2 * data[i + 2]) * amount; // Blue
        }
      }
      // PREPROCESAMIENTO: blur + smoothness
      const preprocessedImageData = preprocessImageForAscii(imageData, {
        blur: debouncedSettings.blur,
        smoothness: debouncedSettings.smoothness,
        highlights: debouncedSettings.highlights,
        luminanceThreshold: debouncedSettings.luminanceThreshold
      });
      // Determinar color personalizado si useCustomColors está activo
      const asciiColor = getAsciiFontColor({
        useCustomColors: debouncedSettings.useCustomColors,
        customNeonColors: debouncedSettings.customNeonColors,
        invert: debouncedSettings.invert,
        opacity: (debouncedSettings.useCustomColors && debouncedSettings.customNeonColors && typeof debouncedSettings.customNeonColors.a === 'number')
          ? debouncedSettings.customNeonColors.a
          : 1
      });
      const columns = Math.floor(image.width / N);
      const rows = Math.floor(image.height / N);
      imageDataToAsciiHTML(preprocessedImageData, {
        width: columns,
        height: rows,
        contrast: 1 + debouncedSettings.contrast / 100,
        brightness: debouncedSettings.midtones / 50 - 1,
        colored: false,
        fontSize: charSize,
        fontFamily: 'monospace',
        lineHeight: 0.6,
        background: debouncedSettings.invert ? '#fff' : '#000',
        color: asciiColor,
      })
        .then(html => setAsciiHTML(html))
        .catch(() => setAsciiHTML('<pre style="color:red">Error generando ASCII</pre>'));
    }
  }, [image, debouncedSettings.style, N, charSize, debouncedSettings.contrast, debouncedSettings.midtones, debouncedSettings.invert, debouncedSettings.scale, debouncedSettings.invertShape, debouncedSettings.useCustomColors, debouncedSettings.customNeonColors, debouncedSettings.blur, debouncedSettings.smoothness, debouncedSettings.highlights, debouncedSettings.luminanceThreshold]);

  // Pan: Mouse events
  const handleMouseDown = (e) => {
    isPanning.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    document.body.style.cursor = 'grabbing'
  }
  const handleMouseMove = (e) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => {
    isPanning.current = false
    document.body.style.cursor = ''
  }

  // Pan: Touch events
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return
    isPanning.current = true
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchMove = (e) => {
    if (!isPanning.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = () => {
    isPanning.current = false
  }

  // Limpiar listeners al desmontar
  React.useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  })

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        console.log('Image dropped:', file)
      }
    }
  }

  // Renderizado simple: solo mostrar el arte ASCII generado
  return (
    <div className="flex flex-col w-full h-full" style={{height: '100%'}}>
      <div className="flex flex-1 justify-center items-center w-full h-full canvas-container">
        {(debouncedSettings.style === 'ASCII' && asciiHTML) ? (
          <div
            className="ascii-art-preview"
            style={{
              background: debouncedSettings.invert ? '#fff' : '#000',
              color: debouncedSettings.invert ? '#000' : '#fff',
              fontFamily: 'monospace',
              fontSize: `${charSize}px`,
              lineHeight: 0.6,
              letterSpacing: '0px',
              textAlign: 'left',
              whiteSpace: 'pre',
              padding: 0,
              margin: 0,
              display: 'block',
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: asciiHTML }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              background: (debouncedSettings.invert && ['Floyd-Steinberg', 'Atkinson', 'Smooth Diffuse', 'Gradient'].includes(debouncedSettings.style)) ? '#fff' : 'transparent'
            }}
          />
        )}
      </div>
    </div>
  )
})

CanvasPreview.displayName = 'CanvasPreview'

export default CanvasPreview
