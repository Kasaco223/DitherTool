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
  customNeonColors
}, ref) => {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)

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

    // Clear canvas and set background to black for the dithered output
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    <div className="flex flex-col h-full">

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex items-center justify-center flex-1 overflow-auto canvas-container"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {image ? (
          <canvas
            ref={canvasRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              imageRendering: zoom > 2 ? 'pixelated' : 'auto'
            }}
          />
        ) : (
          <div className="p-4 text-center text-gray-400 md:p-8">
            <div className="mb-4 text-3xl md:text-4xl">📷</div>
            <p className="mb-2 text-base tracking-wide md:text-lg">No image loaded</p>
            <p className="text-xs tracking-wide md:text-sm">Import an image to get started</p>
          </div>
        )}
      </div>
    </div>
  )
})

CanvasPreview.displayName = 'CanvasPreview'

export default CanvasPreview
