import { useState, useRef, useCallback } from 'react'
import CanvasPreview from './components/CanvasPreview'
import ControlPanel from './components/ControlPanel'

function App() {
  const [image, setImage] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showExportPopup, setShowExportPopup] = useState(false)
  const [settings, setSettings] = useState({
    scale: 1,
    smoothness: 5,
    contrast: 0,
    midtones: 65,
    highlights: 100,
    luminanceThreshold: 50,
    blur: 0,
    invert: false,
    style: 'Floyd-Steinberg'
  })

  // New state for custom colors (single color)
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [customNeonColors, setCustomNeonColors] = useState({ h: 300, s: 100, v: 100 }); // Magenta Neón por defecto

  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null) // New ref for the canvas container

  const handleImageLoad = useCallback((file) => {
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setCanvasSize({ width: img.width, height: img.height })

      // Calculate initial zoom to fit image in container
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth
        const containerHeight = canvasContainerRef.current.clientHeight

        const aspectRatioImage = img.width / img.height
        const aspectRatioContainer = containerWidth / containerHeight

        let newZoom
        if (aspectRatioImage > aspectRatioContainer) {
          // Image is wider than container, fit by width
          newZoom = containerWidth / img.width
        } else {
          // Image is taller than container, fit by height
          newZoom = containerHeight / img.height
        }
        setZoom(newZoom > 1 ? 1 : newZoom) // Don't zoom in beyond 100% if image is small
      } else {
        setZoom(1)
      }
    }
    img.src = URL.createObjectURL(file)
  }, [])

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  // New handler for custom color toggle
  const handleUseCustomColorsToggle = useCallback(() => {
    setUseCustomColors(prev => !prev);
  }, []);

  // New handler to set the custom neon color
  const setCustomNeonColor = useCallback((newColor) => {
    setCustomNeonColors(newColor);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.2, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.2, 0.1))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  const handleExport = useCallback((format) => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn('Canvas no disponible')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.warn('Contexto de canvas no disponible')
      return
    }

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const allTransparent = imageData.data.every((val, i) => i % 4 === 3 ? val === 0 : true)

      if (allTransparent) {
        console.warn('Canvas vacío o completamente transparente')
        return
      }

      // Si es JPG, rellenamos los espacios transparentes con negro
      if (format === 'jpg') {
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        
        // Rellenar con negro
        tempCtx.fillStyle = 'black'
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
        
        // Dibujar la imagen original encima
        tempCtx.drawImage(canvas, 0, 0)
        
        const link = document.createElement('a')
        link.download = 'dithered-image.jpg'
        link.href = tempCanvas.toDataURL('image/jpeg', 1.0)
        link.click()
      } else {
        // PNG mantiene la transparencia
        const link = document.createElement('a')
        link.download = 'dithered-image.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      
      setShowExportPopup(false)
    } catch (err) {
      console.error('Error exportando imagen:', err)
    }
  }, [])

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(prev => !prev)
  }, [])

  return (
    <div className="flex flex-col min-h-screen text-black bg-white md:flex-row">
      {/* Unified Header */}
      <div className="fixed top-0 z-50 flex items-center justify-between w-full p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-medium tracking-tight">Dither Tool</h1>

        {/* Controls for Mobile */}
        <div className="flex items-center space-x-3 md:hidden">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Zoom Out
            </button>
            <span className="text-xs font-medium tracking-wider uppercase">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Zoom In
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Reset
            </button>
          </div>
          <button
            onClick={toggleMobileMenu}
            className="p-0.5 border border-black hover:bg-black hover:text-white relative w-8 h-8 focus:outline-none focus:bg-white focus:text-black transition-all duration-500 active:bg-black active:text-white group"
          >
            <span className={`block w-6 h-0.5 bg-black transition-all duration-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isMobileMenuOpen ? 'rotate-45' : '-translate-y-[7px]'}`}></span>
            <span className={`block w-6 h-0.5 bg-black transition-all duration-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isMobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-black transition-all duration-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isMobileMenuOpen ? '-rotate-45' : 'translate-y-[5px]'}`}></span>
          </button>
        </div>

        {/* Controls for Desktop */}
        <div className="items-center hidden space-x-3 md:flex">
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Zoom Out
            </button>
            <span className="text-xs font-medium tracking-wider uppercase">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Zoom In
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs tracking-wider uppercase transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
            >
              Reset
            </button>
        </div>
      </div>

      {/* Side Menu - Controls */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-80 bg-white transform transition-transform duration-300 ease-in-out overflow-y-auto
        md:relative md:translate-x-0 md:flex-shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ top: '64px' }}> {/* Offset by mobile header height */}
        {/* Header */}
        <header className="sticky top-0 z-10 px-8 py-6 bg-white border-b border-gray-200">
          <h1 className="text-2xl font-medium tracking-tight">Dither Tool</h1>
          <div className="mt-2 text-sm text-gray-500">
            {image ? `${canvasSize.width} × ${canvasSize.height}` : 'No image loaded'}
          </div>
        </header>

        {/* Control Panel */}
        <div className="flex-1 p-8">
          <ControlPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onImageLoad={handleImageLoad}
            onExport={handleExport}
            hasImage={!!image}
            useCustomColors={useCustomColors}
            onUseCustomColorsToggle={handleUseCustomColorsToggle}
            customNeonColors={customNeonColors}
            setCustomNeonColor={setCustomNeonColor}
            setShowExportPopup={setShowExportPopup}
          />
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={canvasContainerRef} className="flex-1 p-4 pt-20 md:p-8"> {/* Adjusted padding-top */}
        <CanvasPreview
          ref={canvasRef}
          image={image}
          settings={settings}
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          canvasSize={canvasSize}
          useCustomColors={useCustomColors}
          customNeonColors={customNeonColors}
        />
      </div>

      {/* Export Popup */}
      {showExportPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white shadow-lg">
            <h2 className="mb-4 text-xl font-medium">Exportar Imagen</h2>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => handleExport('png')}
                className="px-4 py-2 text-white transition-all duration-500 bg-black hover:bg-gray-800 focus:outline-none focus:bg-white focus:text-black active:bg-gray-800"
              >
                Exportar como PNG
              </button>
              <button
                onClick={() => handleExport('jpg')}
                className="px-4 py-2 text-white transition-all duration-500 bg-black hover:bg-gray-800 focus:outline-none focus:bg-white focus:text-black active:bg-gray-800"
              >
                Exportar como JPG
              </button>
              <button
                onClick={() => setShowExportPopup(false)}
                className="px-4 py-2 text-black transition-all duration-500 border border-black hover:bg-black hover:text-white focus:outline-none focus:bg-white focus:text-black active:bg-black active:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
