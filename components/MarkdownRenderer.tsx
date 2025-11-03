
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderContent = () => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Bold **text**
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Unordered lists * item
      if (line.trim().startsWith('* ')) {
        return (
          <li key={index} className="ml-6" dangerouslySetInnerHTML={{ __html: line.substring(2) }}></li>
        );
      }
      
      return <p key={index} dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return <div className="prose prose-invert max-w-none text-slate-300">{renderContent()}</div>;
};

export default MarkdownRenderer;
