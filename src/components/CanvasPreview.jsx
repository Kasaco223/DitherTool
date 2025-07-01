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
      // Determinar color personalizado si useCustomColors está activo
      let asciiColor = debouncedSettings.invert ? '#000' : '#fff';
      if (debouncedSettings.useCustomColors && debouncedSettings.customNeonColors) {
        // Convertir HSV a HEX o RGB
        const { h, s, v } = debouncedSettings.customNeonColors;
        // Conversión HSV a RGB
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
          return `rgb(${r},${g},${b})`;
        }
        asciiColor = hsvToRgb(h, s, v);
      }
      // Aquí puedes aplicar otros sliders (contraste, brillo, etc.) si tienes funciones utilitarias
      // Por ahora, solo se pasa el imageData modificado a ASCII
      const columns = Math.floor(image.width / N);
      const rows = Math.floor(image.height / N);
      imageDataToAsciiHTML(imageData, {
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
        .catch(() => setAsciiHTML('<pre style=\"color:red\">Error generando ASCII</pre>'));
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
      // Determinar color personalizado si useCustomColors está activo
      let asciiColor = debouncedSettings.invert ? '#000' : '#fff';
      if (debouncedSettings.useCustomColors && debouncedSettings.customNeonColors) {
        // Convertir HSV a HEX o RGB
        const { h, s, v } = debouncedSettings.customNeonColors;
        // Conversión HSV a RGB
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
          return `rgb(${r},${g},${b})`;
        }
        asciiColor = hsvToRgb(h, s, v);
      }
      // Aquí puedes aplicar otros sliders (contraste, brillo, etc.) si tienes funciones utilitarias
      // Por ahora, solo se pasa el imageData modificado a ASCII
      const columns = Math.floor(image.width / N);
      const rows = Math.floor(image.height / N);
      imageDataToAsciiHTML(imageData, {
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
        .catch(() => setAsciiHTML('<pre style=\"color:red\">Error generando ASCII</pre>'));
    }
  }, [image, debouncedSettings.style, N, charSize, debouncedSettings.contrast, debouncedSettings.midtones, debouncedSettings.invert, debouncedSettings.scale, debouncedSettings.invertShape, debouncedSettings.useCustomColors, debouncedSettings.customNeonColors]);

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
          <canvas ref={canvasRef} style={{ display: 'block', transform: `scale(${zoom})`, transformOrigin: 'center' }} />
        )}
      </div>
    </div>
  )
})

CanvasPreview.displayName = 'CanvasPreview'

export default CanvasPreview
