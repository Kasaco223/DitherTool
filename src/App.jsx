import { useState, useRef, useCallback, useEffect } from 'react'
import CanvasPreview from './components/CanvasPreview'
import ControlPanel from './components/ControlPanel'
import ExportOptionsPopup from './components/ExportOptionsPopup'

// Hook para detectar mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

function App() {
  const [image, setImage] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
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

  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null) // New ref for the canvas container

  const [menuMinimized, setMenuMinimized] = useState(false);
  const [minimizeButtonAlignUp, setMinimizeButtonAlignUp] = useState(false);

  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Bloquear scroll del body cuando el menú móvil está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // Prevenir zoom por doble tap en mobile
    document.body.style.touchAction = 'manipulation';
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobileMenuOpen]);

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
    setOffset({ x: 0, y: 0 }) // Centrar la imagen
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

  return (
    <div className="flex overflow-x-hidden flex-col min-h-screen text-black bg-white md:flex-row">
      {/* Unified Header */}
      <div className="flex fixed top-0 z-50 justify-between items-center p-4 w-full bg-white border-b border-gray-200">
        <h1 className="text-xl font-medium tracking-tight">Dither Tool</h1>
          <div className="flex items-center space-x-3">
          {/* Botón Exportar en el header */}
          <button
            onClick={() => setShowExportPopup(true)}
            disabled={!image}
            className={`px-4 py-2 text-sm font-medium text-white rounded ${image ? 'bg-black hover:bg-gray-800' : 'bg-gray-300 cursor-not-allowed'} transition-colors`}
          >
            EXPORT
            </button>
        </div>
      </div>

      {/* Side Menu - Controls (desktop) */}
      {!menuMinimized ? (
        <div className={`hidden overflow-y-auto fixed left-0 z-40 w-80 bg-white shadow-lg md:block top-[56px] h-[calc(100vh-56px)]`}>
          <div className="flex-1 p-8 mt-10">
            <ControlPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onImageLoad={handleImageLoad}
              onExport={handleExport}
              hasImage={!!image}
              useCustomColors={useCustomColors}
              onUseCustomColorsToggle={handleUseCustomColorsToggle}
              customNeonColors={customNeonColors}
               setCustomNeonColor={setCustomNeonColors}
              setShowExportPopup={setShowExportPopup}
              onMinimizeMenu={() => setMenuMinimized(true)}
            />
          </div>
        </div>
      ) : null}

      {/* Botón flotante para mostrar menú SOLO en escritorio cuando está minimizado */}
      {menuMinimized && !isMobile && (
        <button
          className="flex fixed left-0 top-1/2 z-50 justify-center items-center w-8 h-8 text-black bg-white rounded-none border border-black"
          style={{ transform: 'translateY(-50%)' }}
          onClick={() => setMenuMinimized(false)}
          title="Abrir menú"
        >
          <span className="block leading-none text-1xl" style={{ transform: 'translateY(-1.5px)' }}>{'>'}</span>
        </button>
      )}

      {/* Botón flotante para mobile, esquina inferior izquierda */}
      {isMobile && !isMobileMenuOpen && (
        <button
          className="flex fixed bottom-4 left-4 z-50 justify-center items-center w-10 h-10 bg-white rounded-none border border-black shadow"
          onClick={() => setIsMobileMenuOpen(true)}
          title="Abrir menú"
        >
          <span className="block text-2xl">{'^'}</span>
        </button>
      )}

      {/* Menú deslizable desde abajo para mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="flex overflow-hidden fixed bottom-0 left-0 z-50 flex-col w-full h-1/2 bg-white shadow-lg md:border-t md:border-black"
          style={{ touchAction: 'pan-y' }}
        >
          {/* Header fijo para el menú mobile */}
          <div className="flex fixed z-10 justify-between items-center px-4 w-full h-12 bg-white" style={{ left: 0, bottom: '50%', minHeight: '48px', maxHeight: '56px', top: 'auto' }}>
            <span className="text-base font-medium">Menu</span>
            <button
              className="flex justify-center items-center w-10 h-10 bg-white rounded-none border border-black shadow"
              onClick={() => setIsMobileMenuOpen(false)}
              title="Cerrar menú"
            >
              <span className="block text-2xl">{'v'}</span>
            </button>
          </div>
          {/* Contenido del menú con margin-top para dejar espacio al header */}
          <div className="overflow-y-auto flex-1 p-4 h-full" style={{ WebkitOverflowScrolling: 'touch', marginTop: '56px' }}>
            <ControlPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onImageLoad={handleImageLoad}
              onExport={handleExport}
              hasImage={!!image}
              useCustomColors={useCustomColors}
              onUseCustomColorsToggle={handleUseCustomColorsToggle}
              customNeonColors={customNeonColors}
              setCustomNeonColor={setCustomNeonColors}
              setShowExportPopup={setShowExportPopup}
            />
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div ref={canvasContainerRef} className="flex-1 p-4 pt-20 w-full md:p-8" style={{height: 'calc(100vh - 56px)'}}>
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
          offset={offset}
          setOffset={setOffset}
        />
        {/* Isla flotante de controles de zoom/reset */}
        <div className="flex fixed left-4 top-20 z-50 flex-row items-center p-2 space-x-2 bg-white rounded-none border border-black shadow-none md:right-6 md:bottom-6 md:left-auto md:top-auto"
          style={{ marginTop: isMobile ? '16px' : undefined }}>
          <button
            onClick={handleZoomIn}
            className="flex justify-center items-center w-8 h-8 text-lg font-normal text-black bg-white rounded-none border border-black hover:bg-gray-100 focus:outline-none"
            title="Zoom In"
          >
            +
          </button>
          <span className="mx-2 text-base font-normal text-black select-none" style={{minWidth: '48px', textAlign: 'center'}}>
            {`${Math.round(zoom * 100)}%`}
          </span>
          <button
            onClick={handleZoomOut}
            className="flex justify-center items-center w-8 h-8 text-lg font-normal text-black bg-white rounded-none border border-black hover:bg-gray-100 focus:outline-none"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleResetZoom}
            className="flex justify-center items-center px-3 ml-2 h-8 text-base font-normal text-black bg-white rounded-none border border-black hover:bg-gray-100 focus:outline-none"
            title="Reset"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Export Popup */}
      {showExportPopup && (
        <ExportOptionsPopup
          onExportPng={() => handleExport('png')}
          onExportJpg={() => handleExport('jpg')}
          onClose={() => setShowExportPopup(false)}
        />
      )}
    </div>
  )
}

export default App
