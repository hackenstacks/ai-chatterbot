
import React, { useState } from 'react';
import { AlertTriangleIcon, XIcon } from './Icons.tsx';
import type { FormattedError } from '../utils/errorUtils.ts';

interface ErrorDisplayProps {
  error: FormattedError;
  onDismiss: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200" role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangleIcon />
        </div>
        <div className="ml-3 flex-grow min-w-0">
          <h3 className="font-bold text-red-100">
            {error.code && `[${error.code}] `} An Error Occurred
          </h3>
          <div className="mt-1 text-sm text-red-200 break-words">
            {error.message}
          </div>
          <div className="mt-3 flex space-x-4 text-sm">
             <button
                onClick={() => setShowDetails(!showDetails)}
                className="font-semibold text-red-100 hover:text-white"
             >
                {showDetails ? 'Hide Details' : 'Show Details'}
             </button>
             <button
                onClick={() => navigator.clipboard.writeText(`Timestamp: ${error.timestamp}\nCode: ${error.code}\nMessage: ${error.message}\n\nDetails:\n${error.details}`)}
                className="font-semibold text-red-100 hover:text-white"
             >
                Copy Error
             </button>
          </div>
          {showDetails && (
            <pre className="mt-3 p-2 bg-slate-900/50 rounded-md text-xs text-slate-300 overflow-auto max-h-40">
                <code>
                    Timestamp: {error.timestamp}\n\n
                    {error.details}
                </code>
            </pre>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
            <button
                onClick={onDismiss}
                className="text-red-200 hover:text-white"
                aria-label="Dismiss"
            >
                <XIcon />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;