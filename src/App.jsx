import { useState, useRef, useCallback, useEffect } from 'react'
import CanvasPreview from './components/CanvasPreview'
import ControlPanel from './components/ControlPanel'
import ExportOptionsPopup from './components/ExportOptionsPopup'
import html2canvas from 'html2canvas'

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
    invertShape: 0,
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

  // Cargar neaCat.png por defecto si no hay imagen
  useEffect(() => {
    if (!image) {
      const img = new window.Image();
      img.onload = () => {
        setImage(img);
        setCanvasSize({ width: img.width, height: img.height });
        // Ajustar zoom inicial si es necesario
        if (canvasContainerRef.current) {
          const containerWidth = canvasContainerRef.current.clientWidth;
          const containerHeight = canvasContainerRef.current.clientHeight;
          const aspectRatioImage = img.width / img.height;
          const aspectRatioContainer = containerWidth / containerHeight;
          let newZoom;
          if (aspectRatioImage > aspectRatioContainer) {
            newZoom = containerWidth / img.width;
          } else {
            newZoom = containerHeight / img.height;
          }
          setZoom(newZoom > 1 ? 1 : newZoom);
        } else {
          setZoom(1);
        }
      };
      img.src = '/neaCat.png';
    }
  }, [image]);

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

  const handleExport = useCallback(async (format) => {
    // Detectar si el modo es ASCII clásico
    if (settings.style === 'ASCII') {
      // Buscar el div de arte ASCII
      const asciiDiv = document.querySelector('.ascii-art-preview');
      if (!asciiDiv) {
        console.warn('No se encontró el div de arte ASCII');
        return;
      }
      // Guardar estilos originales de display y alineación
      const prevDisplay = asciiDiv.style.display;
      const prevAlignItems = asciiDiv.style.alignItems;
      const prevJustifyContent = asciiDiv.style.justifyContent;
      // Aplicar centrado flex
      asciiDiv.style.display = 'flex';
      asciiDiv.style.alignItems = 'center';
      asciiDiv.style.justifyContent = 'center';
      // Obtener el tamaño real del bloque ASCII
      const asciiContent = asciiDiv.firstElementChild || asciiDiv;
      const contentWidth = asciiContent.scrollWidth;
      const contentHeight = asciiContent.scrollHeight;
      // Usar el tamaño de la imagen original para exportar
      const exportWidth = image?.width || asciiDiv.scrollWidth;
      const exportHeight = image?.height || asciiDiv.scrollHeight;
      // Calcular los factores de escala para llenar el área de exportación, con margen de seguridad
      const scaleX = (exportWidth / contentWidth) * 0.98;
      const scaleY = (exportHeight / contentHeight) * 0.98;
      // Guardar el valor original de letter-spacing
      const prevLetterSpacing = asciiDiv.style.letterSpacing;
      // Guardar estilos originales
      const prevStyles = {
        width: asciiDiv.style.width,
        height: asciiDiv.style.height,
        display: asciiDiv.style.display,
        alignItems: asciiDiv.style.alignItems,
        justifyContent: asciiDiv.style.justifyContent,
        margin: asciiDiv.style.margin,
        textAlign: asciiDiv.style.textAlign,
      };
      // Guardar el valor original de transform
      const prevTransform = asciiDiv.style.transform;
      const prevTransformOrigin = asciiDiv.style.transformOrigin;
      // Aplicar el escalado proporcional en ambos ejes
      asciiDiv.style.transform = `scale(${scaleX}, ${scaleY})`;
      asciiDiv.style.transformOrigin = 'center';
      // Calcular el letter-spacing necesario tras el escalado
      const charsPerLine = asciiContent.textContent.split('\n')[0]?.length || 1;
      const scaledCharWidth = (contentWidth * scaleX) / charsPerLine;
      const desiredCharWidth = exportWidth / charsPerLine;
      const letterSpacing = desiredCharWidth - scaledCharWidth;
      asciiDiv.style.letterSpacing = `${letterSpacing}px`;
      // Guardar el fondo original
      const prevBackground = asciiDiv.style.background;
      // Si es PNG, poner fondo transparente
      if (format === 'png') {
        asciiDiv.style.background = 'transparent';
      }
      // Usar html2canvas
      try {
        const canvas = await html2canvas(asciiDiv, {
          backgroundColor: format === 'png' ? null : (settings.invert ? '#fff' : '#000'),
          width: exportWidth,
          height: exportHeight,
          scale: 1
        });
        // Restaurar estilos originales
        Object.entries(prevStyles).forEach(([key, value]) => {
          asciiDiv.style[key] = value;
        });
        asciiDiv.style.transform = '';
        asciiDiv.style.transformOrigin = '';
        asciiDiv.style.letterSpacing = prevLetterSpacing;
        asciiDiv.style.display = prevDisplay;
        asciiDiv.style.alignItems = prevAlignItems;
        asciiDiv.style.justifyContent = prevJustifyContent;
        asciiDiv.style.background = prevBackground;
        const link = document.createElement('a');
        link.download = `ascii-art.${format}`;
        if (format === 'jpg') {
          link.href = canvas.toDataURL('image/jpeg', 1.0);
        } else {
          link.href = canvas.toDataURL('image/png');
        }
        link.click();
        setShowExportPopup(false);
      } catch (err) {
        Object.entries(prevStyles).forEach(([key, value]) => {
          asciiDiv.style[key] = value;
        });
        asciiDiv.style.transform = '';
        asciiDiv.style.transformOrigin = '';
        asciiDiv.style.letterSpacing = prevLetterSpacing;
        asciiDiv.style.display = prevDisplay;
        asciiDiv.style.alignItems = prevAlignItems;
        asciiDiv.style.justifyContent = prevJustifyContent;
        asciiDiv.style.background = prevBackground;
        console.error('Error exportando arte ASCII:', err);
      }
      return;
    }
    // Modo GPU y otros: lógica original
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
      if (format === 'jpg') {
        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        tempCtx.fillStyle = settings.invert ? 'white' : 'black'
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
        tempCtx.drawImage(canvas, 0, 0)
        const link = document.createElement('a')
        link.download = 'dithered-image.jpg'
        link.href = tempCanvas.toDataURL('image/jpeg', 1.0)
        link.click()
      } else {
        const link = document.createElement('a')
        link.download = 'dithered-image.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      setShowExportPopup(false)
    } catch (err) {
      console.error('Error exportando imagen:', err)
    }
  }, [settings, image])

  return (
    <div className="flex overflow-x-hidden flex-col min-h-screen text-black bg-white md:flex-row">
      {/* Unified Header */}
      <div className="flex fixed top-0 z-50 justify-between items-center p-4 w-full bg-white border-b border-gray-200">
        <img src="/ditherTool.svg" alt="Dither Tool Logo" className="h-8 md:h-10 w-auto max-w-[200px]" />
          <div className="flex items-center space-x-3">
          {/* Botón Exportar en el header */}
          <button
            onClick={() => { if (image) setShowExportPopup(true); }}
            className={"px-4 py-2 text-sm font-medium text-white bg-black rounded-none transition-colors hover:bg-gray-800"}
          >
            EXPORT
          </button>
        </div>
      </div>

      {/* Side Menu - Controls (desktop) */}
      {!menuMinimized ? (
        <div className={`hidden overflow-y-auto fixed right-0 z-40 w-80 bg-white shadow-lg md:block top-[56px] h-[calc(100vh-56px)]`}>
          {/* Botón minimizar menú, hijo directo del panel lateral, fuera de ControlPanel */}
          <button
            onClick={() => setMenuMinimized(true)}
            className="flex absolute left-4 top-8 z-10 justify-center items-center p-0 w-6 h-6 text-base font-bold text-black bg-white rounded-none border border-black shadow-none hover:bg-gray-100"
            title="Minimizar menú"
          >
            <span className="block text-xs leading-none" style={{ transform: 'translateY(-1px)' }}>{'>'}</span>
          </button>
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
            />
          </div>
        </div>
      ) : null}

      {/* Botón flotante para mostrar menú SOLO en escritorio cuando está minimizado */}
      {menuMinimized && !isMobile && (
        <button
          className="flex fixed right-0 top-1/2 z-50 justify-center items-center w-8 h-8 text-black bg-white rounded-none border border-black"
          style={{ transform: 'translateY(-50%)' }}
          onClick={() => setMenuMinimized(false)}
          title="Abrir menú"
        >
          <span className="block leading-none text-1xl" style={{ transform: 'translateY(-1.5px)' }}>{'<'}</span>
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
        <>
          <div
            className="flex overflow-hidden fixed bottom-0 left-0 z-50 flex-col w-full h-1/2 bg-white shadow-lg md:border-t md:border-black"
            style={{ touchAction: 'pan-y' }}
          >
            {/* Header fijo para el menú mobile con botón cerrar alineado a la derecha */}
            <div className="flex z-10 justify-between items-center px-4 w-full h-12 bg-white" style={{ minHeight: '48px', maxHeight: '56px' }}>
              <span className="text-base font-medium">Menu</span>
              <button
                className="flex justify-center items-center p-0 w-6 h-6 text-xs font-bold text-black bg-white rounded-none border border-black shadow-none"
                onClick={() => setIsMobileMenuOpen(false)}
                title="Cerrar menú"
              >
                <span className="block">{'v'}</span>
              </button>
            </div>
            {/* Contenido del menú con margin-top para dejar espacio al header */}
            <div className="overflow-y-auto flex-1 p-4 h-full" style={{ WebkitOverflowScrolling: 'touch', marginTop: '48px' }}>
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
        </>
      )}

      {/* Main Canvas Area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 p-4 pt-20 w-full md:p-8"
        style={{
          height: isMobile && isMobileMenuOpen ? '50vh' : 'calc(100vh - 56px)',
          marginRight: !isMobile && !menuMinimized ? '320px' : 0
        }}
      >
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
          invert={settings.invert}
        />
        {/* Isla flotante de controles de zoom/reset en desktop y mobile con menú cerrado (ahora a la izquierda o derecha) */}
        {(!isMobile || (isMobile && !isMobileMenuOpen)) && (
          <div className={`flex fixed bottom-6 ${isMobile ? 'right-6' : 'left-6'} z-50 flex-row items-center p-2 space-x-2 bg-white rounded-none border border-black shadow-none`}>
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
        )}
        {/* Isla de zoom en mobile cuando el menú está ABIERTO: anclada arriba del botón de cerrar menú */}
        {isMobile && isMobileMenuOpen && (
          <div className="flex fixed right-6 z-50" style={{ bottom: 'calc(50% + 10px)' }}>
            <div className="flex flex-row items-center p-2 space-x-2 bg-white rounded-none border border-black shadow-none">
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
        )}
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
