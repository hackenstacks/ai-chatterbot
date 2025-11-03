import React from 'react';
import type { StoredFile } from '../../services/dbService';
import { XIcon, FileTextIcon } from '../../components/Icons';
import { formatBytes } from '../../utils/helpers';

interface FileAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFiles: StoredFile[];
  selectedFiles: string[];
  onSelectionChange: (newSelection: string[]) => void;
}

const FileAccessModal: React.FC<FileAccessModalProps> = ({ isOpen, onClose, availableFiles, selectedFiles, onSelectionChange }) => {
  if (!isOpen) return null;

  const handleToggle = (fileName: string) => {
    const newSelection = selectedFiles.includes(fileName)
      ? selectedFiles.filter(name => name !== fileName)
      : [...selectedFiles, fileName];
    onSelectionChange(newSelection);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white">Grant File Access</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close">
            <XIcon />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          <p className="text-slate-400 mb-4">Select the files you want the AI to be able to access during this chat session.</p>
          <div className="space-y-3">
            {availableFiles.length > 0 ? availableFiles.map(file => (
              <label key={file.name} htmlFor={`file-${file.name}`} className="flex items-center p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                <input
                  type="checkbox"
                  id={`file-${file.name}`}
                  checked={selectedFiles.includes(file.name)}
                  onChange={() => handleToggle(file.name)}
                  className="h-5 w-5 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                <div className="ml-4 flex items-center space-x-3 overflow-hidden">
                  <FileTextIcon />
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-200 truncate">{file.name}</p>
                    <p className="text-sm text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                </div>
              </label>
            )) : (
                <p className="text-slate-500 text-center py-8">Your file library is empty. Add files in the "File Library" tab to grant access.</p>
            )}
          </div>
        </main>
        <footer className="p-6 border-t border-slate-800">
          <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default FileAccessModal;
