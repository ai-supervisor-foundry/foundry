// CommandOutput Component
// Terminal-style output display
import React, { useEffect, useRef } from 'react';

interface CommandOutputProps {
  stdout: string;
  stderr?: string;
  exitCode?: number;
  className?: string;
}

export default function CommandOutput({
  stdout,
  stderr,
  exitCode,
  className = '',
}: CommandOutputProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new output
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [stdout, stderr]);

  const copyToClipboard = () => {
    const text = stderr ? `${stdout}\n\n${stderr}` : stdout;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Output</span>
        {exitCode !== undefined && (
          <span className={`text-sm ${exitCode === 0 ? 'text-green-600' : 'text-red-600'}`}>
            Exit Code: {exitCode}
          </span>
        )}
        <button
          onClick={copyToClipboard}
          className="text-sm px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
        >
          Copy
        </button>
      </div>
      <div
        ref={outputRef}
        className="bg-black text-green-400 font-mono text-sm p-4 rounded overflow-auto max-h-96"
      >
        {stdout && (
          <div className="whitespace-pre-wrap">{stdout}</div>
        )}
        {stderr && (
          <div className="whitespace-pre-wrap text-red-400 mt-2">{stderr}</div>
        )}
        {!stdout && !stderr && (
          <div className="text-gray-500">No output</div>
        )}
      </div>
    </div>
  );
}

