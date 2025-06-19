import React from 'react';

const ExportOptionsPopup = ({ onExportJpg, onExportPng, onClose }) => {
  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center bg-black bg-opacity-50">
      <div className="flex flex-col items-start p-6 bg-white rounded-none shadow-lg">
        <h2 className="mb-6 w-full text-xl font-medium text-left">Export Image</h2>
        <div className="flex flex-row gap-4 mb-0">
          <button
            onClick={onExportPng}
            className="px-6 py-2 font-medium text-white bg-black rounded-none border border-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black"
          >
            PNG
          </button>
          <button
            onClick={onExportJpg}
            className="px-6 py-2 font-medium text-white bg-black rounded-none border border-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black"
          >
            JPG
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 font-medium text-black bg-white rounded-none border border-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-black"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportOptionsPopup; 