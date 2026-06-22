"use client";

import { useRef } from "react";

interface HeaderActionsClientProps {
  isProcessing: boolean;
  dataSourceLine: string;
  processingLabel: string;
  processingProgress: number;
  importWarning: string | null;
  onLoadSample: () => void;
  onOpenSampleData: () => void;
  onOpenSampleFormat: () => void;
  onUploadFile: (file: File) => void;
}

export function HeaderActionsClient({
  isProcessing,
  dataSourceLine,
  processingLabel,
  processingProgress,
  importWarning,
  onLoadSample,
  onOpenSampleData,
  onOpenSampleFormat,
  onUploadFile,
}: HeaderActionsClientProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="header-actions">
      <div className="header-action-row">
        <div className="header-action-stack">
          <button className="primary-button" type="button" disabled={isProcessing} onClick={onLoadSample}>
            Load sample data
          </button>
          <button className="sample-format-link" type="button" onClick={onOpenSampleData}>
            See sample data
          </button>
        </div>
        <div className="header-action-stack">
          <button className="primary-button" type="button" disabled={isProcessing} onClick={() => importInputRef.current?.click()}>
            Load your own data
          </button>
          <button className="sample-format-link" type="button" onClick={onOpenSampleFormat}>
            Sample format
          </button>
        </div>
        <input
          ref={importInputRef}
          className="file-input-hidden"
          type="file"
          accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onUploadFile(file);
            event.target.value = "";
          }}
        />
      </div>

      <p className="dataset-notice">{dataSourceLine}</p>

      {isProcessing ? (
        <div className="processing-panel" role="status" aria-live="polite">
          <div className="processing-copy-row">
            <strong>{processingLabel}</strong>
            <span>{Math.round(processingProgress)}%</span>
          </div>
          <div className="processing-bar-track">
            <span className="processing-bar-fill" style={{ width: `${processingProgress}%` }} />
          </div>
        </div>
      ) : null}

      {importWarning ? <p className="import-warning">{importWarning}</p> : null}
    </div>
  );
}
