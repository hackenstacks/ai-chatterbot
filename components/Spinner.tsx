
import React from 'react';

const Spinner: React.FC<{ text?: string }> = ({ text = "Thinking..." }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
};

export default Spinner;
