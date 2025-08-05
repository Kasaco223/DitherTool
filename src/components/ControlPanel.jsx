import { useRef, useState, useEffect } from 'react'
import { hsvToRgb, rgbToHsv } from '../utils/dithering'
import { HsvaColorPicker } from 'react-colorful'
import CustomSelect from './CustomSelect'

// Funciones auxiliares para conversión de color
function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}
function hexToRgb(hex) {
  hex = hex.replace('#', '')
  if (hex.length === 3) {
    hex = hex.split('').map((x) => x + x).join('')
  }
  const num = parseInt(hex, 16)
  return [num >> 16, (num >> 8) & 255, num & 255]
}
function rgbToString(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`
}
function stringToRgb(str) {
  const match = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return null
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}
function hsvToHsl(h, s, v) {
  s /= 100; v /= 100;
  let l = v * (1 - s / 2);
  let sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);
  return [h, sl * 100, l * 100]
}
function hslToHsv(h, s, l) {
  s /= 100; l /= 100;
  let v = l + s * Math.min(l, 1 - l);
  let sv = v === 0 ? 0 : 2 * (1 - l / v);
  return [h, sv * 100, v * 100]
}
function hslToString(h, s, l) {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
}
function stringToHsl(str) {
  const match = str.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/)
  if (!match) return null
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
}

const PRESETS_KEY = 'dither_tool_presets_v1';

const DEFAULT_SETTINGS = {
  scale: 1,
  smoothness: 0,
  contrast: 0,
  midtones: 50,
  highlights: 100,
  luminanceThreshold: 50,
  blur: 0,
  style: 'Floyd-Steinberg',
  invert: false
};
const DEFAULT_CUSTOM_NEON_COLORS = { h: 0, s: 100, v: 100, a: 1 };

const ControlPanel = ({
  settings,
  onSettingsChange,
  onImageLoad,
  onExport,
  hasImage,
  useCustomColors,
  onUseCustomColorsToggle,
  customNeonColors,
  setCustomNeonColor,
  setShowExportPopup,
  onMinimizeMenu
}) => {
  const fileInputRef = useRef(null)

  // Estado para formato y valor del input de color
  const [colorFormat, setColorFormat] = useState('HEX')
  const [colorInput, setColorInput] = useState('')
  const [pendingColor, setPendingColor] = useState('')

  // Sincroniza el input cuando cambia el color del picker o el formato
  useEffect(() => {
    const [r, g, b] = hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v)
    if (colorFormat === 'HEX') {
      setColorInput(rgbToHex(r, g, b))
      setPendingColor(rgbToHex(r, g, b))
    } else if (colorFormat === 'RGB') {
      setColorInput(rgbToString(r, g, b))
      setPendingColor(rgbToString(r, g, b))
    } else if (colorFormat === 'HSL') {
      const [h, s, l] = hsvToHsl(customNeonColors.h, customNeonColors.s, customNeonColors.v)
      setColorInput(hslToString(h, s, l))
      setPendingColor(hslToString(h, s, l))
    }
    // eslint-disable-next-line
  }, [customNeonColors, colorFormat])

  // Añadir safeSetCustomNeonColor como función auxiliar
  const safeSetCustomNeonColor = (newColor) => {
    // Si el color es blanco puro, lo forzamos a v=99.6 (da 254 en RGB)
    let h = newColor.h, s = newColor.s, v = newColor.v;
    if (s === 0 && v === 100) {
      v = 99.6;
    }
    setCustomNeonColor(prev => ({
      ...newColor,
      h,
      s,
      v,
      a: typeof newColor.a === 'number' ? newColor.a : (prev.a ?? 1)
    }));
  };

  // Cuando el usuario escribe en el input (solo actualiza el valor local)
  const handleColorInputChange = (e) => {
    setPendingColor(e.target.value)
  }

  // Aplica el color cuando se presiona Enter o el botón
  const applyPendingColor = () => {
    let rgb
    if (colorFormat === 'HEX') {
      try {
        rgb = hexToRgb(pendingColor)
      } catch { rgb = null }
    } else if (colorFormat === 'RGB') {
      rgb = stringToRgb(pendingColor)
    } else if (colorFormat === 'HSL') {
      const hsl = stringToHsl(pendingColor)
      if (hsl) {
        const [h, s, l] = hsl
        rgb = hsvToRgb(...hslToHsv(h, s, l))
      }
    }
    if (rgb && rgb.every((x) => !isNaN(x))) {
      const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2])
      safeSetCustomNeonColor({ h, s, v })
    }
  }

  // Permite aplicar con Enter
  const handleColorInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyPendingColor()
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageLoad(file)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleSliderChange = (key, value) => {
    onSettingsChange({ [key]: parseFloat(value) })
  }

  const handleToggleChange = (key, checked) => {
    onSettingsChange({ [key]: checked })
  }

  const handleSelectChange = (key, value) => {
    onSettingsChange({ [key]: value })
  }

  // Cambiar el handler para desactivar invert cuando se desactiven los custom colors
  const handleLocalUseCustomColorsToggle = () => {
    if (useCustomColors) {
      // Si se apaga, también apaga invert
      onSettingsChange({ useCustomColors: false, invert: false });
    } else {
      onSettingsChange({ useCustomColors: true });
    }
    onUseCustomColorsToggle();
  };

  // Función para obtener el background del slider con gradiente
  function getSliderBg(value, min, max) {
    const percent = ((value - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, #000 0%, #000 ${percent}%, #e5e5e5 ${percent}%, #e5e5e5 100%)`
    };
  }

  return (
    <div className="flex relative flex-col">
      {onMinimizeMenu && (
        <button
          onClick={onMinimizeMenu}
          className="flex absolute top-4 left-4 z-10 justify-center items-center p-0 w-6 h-6 text-base font-bold text-black bg-white rounded-none border border-black shadow-none hover:bg-gray-100"
          title="Minimizar menú"
        >
          <span className="block text-xs leading-none" style={{ transform: 'translateY(-1px)' }}>{'<'}</span>
        </button>
      )}
      {/* Import/Export Buttons y Minimizar */}
      <div className="mb-3 space-y-2 md:mb-4 md:space-y-3">
        <div className="flex flex-row gap-3 items-center mb-2 w-full">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            className="flex-1 h-12 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-black hover:bg-black hover:text-white transition-all duration-300 rounded-none flex items-center justify-center"
          >
            Import Image
          </button>
        </div>
      </div>
      {/*<button
        onClick={() => setShowExportPopup(true)}
        disabled={!hasImage}
        className={`w-full px-4 py-2 text-sm font-medium text-white rounded-none ${hasImage
            ? 'bg-black hover:bg-gray-800'
            : 'bg-gray-300 cursor-not-allowed'
        } transition-colors`}
      >
        Export
      </button> */}
      {/*
      <div className="slider-separator"></div>*/}
      {/* Presets Dropdown */}
      {/*
      <div>
        <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Presets</label>
        <CustomSelect
          options={[
            { value: 'none', label: 'None', deletable: false },
            ...presets.map(p => ({ value: p.name, label: p.name, deletable: true }))
          ]}
          value={selectedPreset}
          onChange={handleSelectPreset}
          className="w-full text-xs md:text-sm"
        />
        {selectedPreset !== 'none' && (
          <button
            onClick={() => deletePreset(selectedPreset)}
            className="px-2 py-1 mt-2 w-full text-xs text-red-600 rounded-none border border-red-400 hover:bg-red-50"
          >
            Delete preset
          </button>
        )}
         <button
          onClick={() => setShowPresetPopup(true)}
          className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-black text-black bg-white hover:bg-gray-100 mt-4"
        >
          Save Preset
        </button>
      </div>
      */}
      <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>
      {/* Settings Panel */}
      <div className="overflow-y-auto control-panel">
        <div className="space-y-1 md:space-y-2">
          {/* Style Dropdown */}
          <div>
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Style</label>
            <CustomSelect
              options={[
                { value: 'Floyd-Steinberg', label: 'Floyd-Steinberg' },
                { value: 'Atkinson', label: 'Atkinson' },
                { value: 'Smooth Diffuse', label: 'Smooth Diffuse' },
                { value: 'Stippling', label: 'Stippling' },
                { value: 'Gradient', label: 'Gradient' },
                { value: 'ASCII', label: 'ASCII' },
              ]}
              value={settings.style}
              onChange={val => handleSelectChange('style', val)}
              className="w-full"
            />
          </div>
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* Scale Slider */}
          <div className="mb-0.5 slider-container">
            <div className="flex justify-between mb-0.5 mt-1">
              <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Scale</label>
              <span className="text-xs font-medium md:text-sm">{settings.scale}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.scale}
              onChange={(e) => handleSliderChange('scale', e.target.value)}
              className="slider"
              style={getSliderBg(settings.scale, 0.1, 1)}
            />
          </div>
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* Smoothness Slider */}
          <div className="mb-0.5 slider-container">
            <div className="flex justify-between mb-0.5 mt-1">
              <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Smoothness</label>
              <span className="text-xs font-medium md:text-sm">{settings.smoothness}</span>
            </div>
            <input
              type="range"
              min={settings.style === 'Gradient' ? "3" : "0"}
              max={settings.style === 'Gradient' ? "5" : "10"}
              step={settings.style === 'Gradient' ? "0.1" : "1"}
              value={settings.smoothness}
              onChange={(e) => handleSliderChange('smoothness', e.target.value)}
              className="slider"
              style={getSliderBg(settings.smoothness, settings.style === 'Gradient' ? 3 : 0, settings.style === 'Gradient' ? 5 : 10)}
            />
          </div>
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* Contrast Slider */}
          <div className="mb-0.5 slider-container">
            <div className="flex justify-between mb-0.5 mt-1">
              <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Contrast</label>
              <span className="text-xs font-medium md:text-sm">{settings.contrast}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.contrast}
              onChange={(e) => handleSliderChange('contrast', e.target.value)}
              className="slider"
              style={getSliderBg(settings.contrast, -100, 100)}
            />
          </div>
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* Midtones Slider */}
          <div className="mb-0.5 slider-container">
            <div className="flex justify-between mb-0.5 mt-1">
              <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Midtones</label>
              <span className="text-xs font-medium md:text-sm">{settings.midtones}</span>
            </div>
            <input
              type="range"
              min="0"
              max={settings.style === 'Gradient' ? "90" : "100"}
              step="1"
              value={settings.midtones}
              onChange={(e) => handleSliderChange('midtones', e.target.value)}
              className="slider"
              style={getSliderBg(settings.midtones, 0, settings.style === 'Gradient' ? 90 : 100)}
            />
          </div>
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* Highlights Slider */}
          {settings.style !== 'Gradient' && (
            <div className="mb-0.5 slider-container">
              <div className="flex justify-between mb-0.5 mt-1">
                <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Highlights</label>
                <span className="text-xs font-medium md:text-sm">{settings.highlights}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.highlights}
                onChange={(e) => handleSliderChange('highlights', e.target.value)}
                className="slider"
                style={getSliderBg(settings.highlights, 0, 100)}
              />
            </div>
          )}
          {settings.style !== 'Gradient' && <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>}

          {/* Luminance Threshold Slider */}
          {settings.style !== 'Gradient' && (
            <div className="mb-0.5 slider-container">
              <div className="flex justify-between mb-0.5 mt-1">
                <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Luminance Threshold</label>
                <span className="text-xs font-medium md:text-sm">{settings.luminanceThreshold}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.luminanceThreshold}
                onChange={(e) => handleSliderChange('luminanceThreshold', e.target.value)}
                className="slider"
                style={getSliderBg(settings.luminanceThreshold, 0, 100)}
              />
            </div>
          )}
          {settings.style !== 'Gradient' && <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>}

          {/* Blur Slider */}
          {settings.style !== 'Gradient' && (
            <div className="mb-0.5 slider-container">
              <div className="flex justify-between mb-0.5 mt-1">
                <label className="text-xs font-medium tracking-wide uppercase md:text-sm">Blur</label>
                <span className="text-xs font-medium md:text-sm">{settings.blur}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={settings.blur}
                onChange={(e) => handleSliderChange('blur', e.target.value)}
                className="slider"
                style={getSliderBg(settings.blur, 0, 10)}
              />
            </div>
          )}
          <div className="slider-separator" style={{margin: '6px 0 4px 0', height: '1px'}}></div>

          {/* InvertShape Slider */}
          {settings.style !== 'Gradient' && (
            <div className="mb-3 md:mb-4">
              <label
                htmlFor="invertShape-slider"
                className="flex justify-between mb-2 text-xs font-medium tracking-wide uppercase md:text-sm"
              >
                <span>Invert Shape</span>
                <span>{settings.invertShape}</span>
              </label>
              <input
                id="invertShape-slider"
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.invertShape}
                onChange={(e) => handleSliderChange('invertShape', e.target.value)}
                className="slider"
                style={getSliderBg(settings.invertShape, 0, 100)}
              />
            </div>
          )}
        </div>
        {/* --- BLOQUE CUSTOM COLORS ABAJO --- */}
        <div className="mt-1">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="useCustomColors"
              checked={useCustomColors}
              onChange={handleLocalUseCustomColorsToggle}
              className="w-4 h-4 rounded-none border-gray-200 focus:ring-black focus:ring-offset-0"
            />
            <label htmlFor="useCustomColors" className="text-xs font-medium tracking-wide uppercase md:text-sm">
              Use Custom Colors
            </label>
          </div>
          {useCustomColors && (
            <div className="pt-4">
              <div className="mx-auto" style={{ width: 210, height: 210 }}>
                <HsvaColorPicker
                  color={{ ...customNeonColors, a: 1 }}
                  onChange={(newColor) => safeSetCustomNeonColor({ ...newColor, a: customNeonColors.a ?? 1 })}
                  style={{ width: '100%', height: '100%' }}
                  alpha={false}
                />
              </div>
              <div className="flex items-center mt-1 mb-0.5 w-full">
                <label htmlFor="alpha-input" className="flex-1 text-xs font-medium tracking-wide text-left uppercase md:text-sm">Opacity</label>
                <input
                  id="alpha-input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round((customNeonColors.a ?? 1) * 100)}
                  onChange={e => {
                    let val = Math.max(0, Math.min(100, Number(e.target.value)));
                    safeSetCustomNeonColor({ ...customNeonColors, a: val / 100 });
                  }}
                  className="px-2 py-1 mx-2 w-16 text-xs text-right border border-black"
                />
                <span className="text-xs">%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round((customNeonColors.a ?? 1) * 100)}
                onChange={e => {
                  let val = Math.max(0, Math.min(100, Number(e.target.value)));
                  safeSetCustomNeonColor({ ...customNeonColors, a: val / 100 });
                }}
                className="w-full slider"
                style={getSliderBg(Math.round((customNeonColors.a ?? 1) * 100), 0, 100)}
              />
              <div className="flex flex-col mt-1 space-y-0.5">
                <CustomSelect
                  options={[
                    { value: 'HEX', label: 'HEX' },
                    { value: 'RGB', label: 'RGB' },
                    { value: 'HSL', label: 'HSL' },
                  ]}
                  value={colorFormat}
                  onChange={setColorFormat}
                  className="w-full text-xs"
                />
                <div className="flex flex-row space-x-2">
                  <input
                    type="text"
                    value={pendingColor}
                    onChange={handleColorInputChange}
                    onKeyDown={handleColorInputKeyDown}
                    className="px-2 py-1 w-full text-xs border border-black"
                    spellCheck={false}
                  />
                  <button
                    onClick={applyPendingColor}
                    className="px-3 py-1 text-xs font-medium bg-white rounded-none border border-black hover:bg-gray-100"
                  >
                    Apply
                  </button>
                </div>
              </div>
              <div className="flex items-center mt-1 space-x-1">
                <input
                  type="checkbox"
                  id="invert"
                  checked={settings.invert}
                  disabled={!useCustomColors}
                  onChange={(e) => handleToggleChange('invert', e.target.checked)}
                  className="w-4 h-4 rounded-none border-gray-200 focus:ring-black focus:ring-offset-0"
                />
                <label htmlFor="invert" className="text-xs font-medium tracking-wide uppercase md:text-sm">
                  Invert color
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Botón RESET ALL al final */}
      <button
        onClick={() => {
          onSettingsChange(DEFAULT_SETTINGS);
          safeSetCustomNeonColor(DEFAULT_CUSTOM_NEON_COLORS);
          // Forzar que useCustomColors se apague
          if (useCustomColors) {
            onUseCustomColorsToggle();
          }
        }}
        className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-black text-black bg-white hover:bg-gray-100 mt-8"
      >
        RESET ALL
      </button>
    </div>
  )
}

export default ControlPanel