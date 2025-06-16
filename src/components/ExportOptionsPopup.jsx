import React from 'react';

const ExportOptionsPopup = ({ onExportJpg, onExportPng, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="p-6 text-center bg-white rounded-lg shadow-lg">
        <h2 className="mb-4 text-xl font-medium">Exportar como:</h2>
        <div className="flex space-x-4">
          <button
            onClick={onExportJpg}
            className="px-4 py-2 transition-all duration-300 border border-black hover:bg-black hover:text-white"
          >
            JPG (Fondo Negro)
          </button>
          <button
            onClick={onExportPng}
            className="px-4 py-2 transition-all duration-300 border border-black hover:bg-black hover:text-white"
          >
            PNG (Fondo Transparente)
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

export default ExportOptionsPopup; 