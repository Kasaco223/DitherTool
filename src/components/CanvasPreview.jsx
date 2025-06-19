import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { applyFloydSteinberg, applyAtkinson, applySmoothDiffuse } from '../utils/dithering'

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

  const debouncedSettings = useDebounce({
    ...settings,
    useCustomColors,
    customNeonColors
  }, 100)

  useEffect(() => {
    if (!image || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = image.width
    canvas.height = image.height

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let processedImageData
    switch (debouncedSettings.style) {
      case 'Atkinson':
        processedImageData = applyAtkinson(imageData, debouncedSettings)
        break
      case 'Smooth Diffuse':
        processedImageData = applySmoothDiffuse(imageData, debouncedSettings)
        break
      case 'Floyd-Steinberg':
      default:
        processedImageData = applyFloydSteinberg(imageData, debouncedSettings)
        break
    }

    // Clear canvas y deja fondo transparente para que la opacidad de las partículas sea visible
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = processedImageData.data;
    const processedWidth = processedImageData.width;
    const processedHeight = processedImageData.height;
    const ditherStyle = debouncedSettings.style;

    // Optimize rendering based on dither style
    if (ditherStyle === 'Floyd-Steinberg' || ditherStyle === 'Atkinson') {
      // Use pre-rendered dot pattern for performance
      const finalImageData = ctx.createImageData(processedWidth, processedHeight);
      const finalData = finalImageData.data;
      const dotSize = 1; // Size of the dot pattern (1x1 pixel for simplicity)

      for (let y = 0; y < processedHeight; y++) {
        for (let x = 0; x < processedWidth; x++) {
          const i = (y * processedWidth + x) * 4; // Index in processedData
          const pixelR = data[i];
          const pixelG = data[i + 1];
          const pixelB = data[i + 2];
          const pixelA = data[i + 3];

          if (pixelR !== 0 || pixelG !== 0 || pixelB !== 0) { // If not black
            const dotColor = `rgba(${pixelR}, ${pixelG}, ${pixelB}, ${pixelA / 255})`;
            const dotPattern = getDotPattern(dotSize, dotColor);
            const dotData = dotPattern.data;

            // Copy dot pattern data to finalData
            for (let dy = 0; dy < dotSize; dy++) {
              for (let dx = 0; dx < dotSize; dx++) {
                const sourceIdx = (dy * dotSize + dx) * 4;
                const destIdx = ((y * dotSize + dy) * (processedWidth * dotSize) + (x * dotSize + dx)) * 4;

                finalData[destIdx] = dotData[sourceIdx];
                finalData[destIdx + 1] = dotData[sourceIdx + 1];
                finalData[destIdx + 2] = dotData[sourceIdx + 2];
                finalData[destIdx + 3] = dotData[sourceIdx + 3];
              }
            }
          }
        }
      }
      ctx.putImageData(finalImageData, 0, 0);

    } else if (ditherStyle === 'Smooth Diffuse') {
      // For Smooth Diffuse, draw squares directly (already optimized for lines)
      for (let y = 0; y < processedHeight; y++) {
        for (let x = 0; x < processedWidth; x++) {
          const i = (y * processedWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (r !== 0 || g !== 0 || b !== 0) { 
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            ctx.fillRect(x, y, 1, 1); // Dibuja un cuadrado de 1x1
          }
        }
      }
    }

  }, [image, debouncedSettings])

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

  return (
    <div className="flex flex-col w-full h-full" style={{height: '100%'}}>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex overflow-auto flex-1 justify-center items-center w-full h-full canvas-container"
        style={{
          backgroundColor: invert ? '#ffffff' : '#000000',
          height: '100%'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {image ? (
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center',
              imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              cursor: isPanning.current ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          />
        ) : (
          <div className="flex flex-col justify-center items-center p-4 w-full h-full md:p-8">
            <img src="/Upload_Image.svg" alt="Upload" className="mb-4 w-5 h-5 md:w-14 md:h-14" />
            <p className="mb-2 text-[8px] tracking-wide text-gray-200 md:text-lg">No image loaded</p>
            <p className="mb-2 text-[8px] tracking-wide text-gray-400 md:text-sm">Import an image to get started</p>
            <button
              className="px-1 py-0 text-[8px] md:px-8 md:py-2 md:text-base font-medium border border-black bg-white text-black rounded-none hover:bg-black hover:text-white transition-all duration-200 mt-2 md:mt-4"
              onClick={() => document.querySelector('input[type=file]')?.click()}
            >
              IMPORT IMAGE
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

CanvasPreview.displayName = 'CanvasPreview'

export default CanvasPreview
