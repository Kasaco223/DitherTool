import { useRef } from 'react'
import { hsvToRgb } from '../utils/dithering'
import { HsvaColorPicker } from 'react-colorful'

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
  setShowExportPopup
}) => {
  const fileInputRef = useRef(null)

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

  return (
    <div className="flex flex-col h-full">
      {/* Import/Export Buttons */}
      <div className="mb-6 space-y-3 md:mb-8 md:space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={handleImportClick}
          className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-black hover:bg-black hover:text-white transition-all duration-300"
        >
          Import Image
        </button>
        <button
          onClick={() => setShowExportPopup(true)}
          disabled={!hasImage}
          className={`w-full px-4 py-2 text-sm font-medium text-white rounded ${
            hasImage
              ? 'bg-black hover:bg-gray-800'
              : 'bg-gray-300 cursor-not-allowed'
          } transition-colors`}
        >
          Export
        </button>
      </div>

      {/* Settings Panel */}
      <div className="flex-1 overflow-y-auto control-panel">
        <div className="space-y-6 md:space-y-8">
          {/* Custom Colors Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="useCustomColors"
              checked={useCustomColors}
              onChange={onUseCustomColorsToggle}
              className="w-4 h-4 border-gray-200 rounded-none focus:ring-black focus:ring-offset-0"
            />
            <label htmlFor="useCustomColors" className="text-xs font-medium tracking-wide uppercase md:text-sm">
              Use Custom Colors
            </label>
          </div>

          {/* Custom Color Selector (conditionally rendered) */}
          {useCustomColors && (
            <div className="pt-4 space-y-4 border-t border-gray-200">
              <label className="block text-xs font-medium tracking-wide uppercase md:text-sm">Define Neon Color</label>
              <div
                style={{
                  backgroundColor: customNeonColors
                    ? `rgb(${hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v)[0]}, ${
                        hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v)[1]
                      }, ${hsvToRgb(customNeonColors.h, customNeonColors.s, customNeonColors.v)[2]})`
                    : '#ccc',
                }}
                className="flex items-center justify-center w-full h-12 border border-gray-300 rounded-none"
              >
                {/* Current selected color preview */}
              </div>
              <HsvaColorPicker
                color={{ ...customNeonColors, a: 1 }} // Add alpha for the picker
                onChange={(newColor) => setCustomNeonColor({ h: newColor.h, s: newColor.s, v: newColor.v })}
              />
            </div>
          )}

          {/* Style Dropdown */}
          <div>
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Style</label>
            <select
              value={settings.style}
              onChange={(e) => handleSelectChange('style', e.target.value)}
              className="w-full px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white border border-gray-200 focus:border-black focus:outline-none transition-all duration-300"
            >
              <option value="Floyd-Steinberg">Floyd-Steinberg</option>
              <option value="Atkinson">Atkinson</option>
              <option value="Smooth Diffuse">Smooth Diffuse</option>
            </select>
          </div>

          {/* Presets Dropdown */}
          <div>
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">Presets</label>
            <select
              className="w-full px-3 py-1.5 md:py-2 text-xs md:text-sm bg-white border border-gray-200 focus:border-black focus:outline-none transition-all duration-300"
              disabled
            >
              <option>None</option>
            </select>
          </div>

          {/* Scale Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Scale: {settings.scale}
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.scale}
              onChange={(e) => handleSliderChange('scale', e.target.value)}
              className="slider"
            />
          </div>

          {/* Smoothness Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Smoothness: {settings.smoothness}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.smoothness}
              onChange={(e) => handleSliderChange('smoothness', e.target.value)}
              className="slider"
            />
          </div>

          {/* Contrast Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Contrast: {settings.contrast}
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={settings.contrast}
              onChange={(e) => handleSliderChange('contrast', e.target.value)}
              className="slider"
            />
          </div>

          {/* Midtones Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Midtones: {settings.midtones}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.midtones}
              onChange={(e) => handleSliderChange('midtones', e.target.value)}
              className="slider"
            />
          </div>

          {/* Highlights Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Highlights: {settings.highlights}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.highlights}
              onChange={(e) => handleSliderChange('highlights', e.target.value)}
              className="slider"
            />
          </div>

          {/* Luminance Threshold Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Luminance Threshold: {settings.luminanceThreshold}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={settings.luminanceThreshold}
              onChange={(e) => handleSliderChange('luminanceThreshold', e.target.value)}
              className="slider"
            />
          </div>

          {/* Blur Slider */}
          <div className="slider-container">
            <label className="block mb-2 text-xs font-medium tracking-wide uppercase md:mb-3 md:text-sm">
              Blur: {settings.blur}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.blur}
              onChange={(e) => handleSliderChange('blur', e.target.value)}
              className="slider"
            />
          </div>

          {/* Invert Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="invert"
              checked={settings.invert}
              onChange={(e) => handleToggleChange('invert', e.target.checked)}
              className="w-4 h-4 border-gray-200 rounded-none focus:ring-black focus:ring-offset-0"
            />
            <label htmlFor="invert" className="text-xs font-medium tracking-wide uppercase md:text-sm">
              Invert
            </label>
          </div>
        </div>

        {/* Save Preset Button */}
        <div className="pt-6 mt-6 border-t border-gray-200 md:pt-8 md:mt-8">
          <button
            disabled
            className="w-full px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm uppercase tracking-wider border border-gray-200 text-gray-400 cursor-not-allowed"
          >
            Save Preset (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  )
}

export default ControlPanel