
import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Process the content string into a safe HTML string
  let html = content
    // Escape HTML to prevent XSS, except for our own tags
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    // Convert markdown bold to <strong> tags
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Split into lines to process paragraphs and lists
    .split('\n')
    .map(line => {
      // Convert markdown list items to <li> tags
      if (line.trim().startsWith('* ')) {
        // Return just the list item content, we'll wrap with <ul> later
        return `<li>${line.trim().substring(2)}</li>`;
      }
      // Wrap non-list lines in <p> tags if they have content
      return line.trim() ? `<p>${line}</p>` : '';
    })
    .join('');

  // Group consecutive list items into a single <ul>
  html = html.replace(/(<li>.*?<\/li>)+/g, (match) => `<ul class="list-disc list-inside my-2 space-y-1">${match}</ul>`);

  // Remove empty paragraphs that might result from list processing or blank lines
  html = html.replace(/<p><\/p>/g, '');

  return (
    <div 
      className="prose prose-invert max-w-none text-slate-300" 
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

export default MarkdownRenderer;
