// ─────────────────────────────────────────────────────────────
// src/components/ImportExcelModal.jsx
// Reusable Excel import modal with drag-and-drop, preview, results
// Usage: <ImportExcelModal onClose={fn} onSuccess={fn} />
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsAPI, downloadBlob } from '../api/services';
import toast from 'react-hot-toast';
import { X, FileDown, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export default function ImportExcelModal({ onClose }) {
  const qc = useQueryClient();
  const fileInputRef = useRef();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null); // import result after success

  // Download template
  const [downloading, setDownloading] = useState(false);
  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await productsAPI.importTemplate();
      downloadBlob(res, 'products-import-template.xlsx');
      toast.success('Template downloaded!');
    } catch {
      toast.error('Failed to download template.');
    } finally {
      setDownloading(false);
    }
  }

  // File selection
  function handleFileSelect(e) {
    const f = e.target.files[0];
    if (f) pickFile(f);
  }

  function pickFile(f) {
    if (!f.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx Excel files are supported.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File is too large (max 5 MB).');
      return;
    }
    setFile(f);
    setResult(null);
  }

  // Drag and drop
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }, []);

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  // Upload & import
  const importMutation = useMutation({
    mutationFn: () => productsAPI.importExcel(file),
    onSuccess: (res) => {
      const data = res.data;
      setResult(data.data);
      toast.success(data.message);
      qc.invalidateQueries(['products']);
      qc.invalidateQueries(['dashboard']);
    },
    onError: (e) => {
      const msg = e.response?.data?.message || 'Import failed.';
      const errors = e.response?.data?.errors || [];
      toast.error(msg);
      if (errors.length) setResult({ added: 0, skipped: errors.length, errors });
    },
  });

  const done = result && result.added > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileSpreadsheet size={16} style={{ color: 'var(--brand)' }} />
            Import Products from Excel
          </div>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step 1 — Template */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Step 1 — Download Template <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--brand)' }}>(already have a sheet? skip to Step 2)</span>
            </div>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Required columns: <strong>Product Name</strong>, <strong>Sale Price</strong>.<br />
              ✅ Also works directly with <strong>Pakistan medicines CSV format</strong>: <code style={{ fontSize: 11 }}>medicine name | company | pack_size | sale_price | mrp</code>
            </p>
            <button
              className="btn btn-outline btn-sm"
              style={{ gap: 6 }}
              disabled={downloading}
              onClick={handleDownloadTemplate}
            >
              <FileDown size={13} />
              {downloading ? 'Downloading...' : 'Download Template (.xlsx)'}
            </button>
          </div>

          {/* Step 2 — Upload */}
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
              Step 2 — Upload Filled Excel File
            </div>

            {/* Drag-and-drop zone */}
            <div
              style={{
                border: `2px dashed ${dragOver ? 'var(--brand)' : file ? '#22c55e' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '28px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: dragOver ? 'rgba(27,75,64,0.05)' : file ? '#f0fdf4' : 'var(--bg)',
              }}
              onClick={() => fileInputRef.current.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                id="excel-file-input"
              />

              {file ? (
                <>
                  <FileSpreadsheet size={32} style={{ color: '#22c55e', marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#16a34a' }}>{file.name}</div>
                  <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                    {(file.size / 1024).toFixed(1)} KB — Click to change file
                  </div>
                </>
              ) : (
                <>
                  <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Drop your Excel file here</div>
                  <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                    or click to browse — .xlsx only, max 5 MB
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Result panel — shown after import */}
          {result && (
            <div style={{
              borderRadius: 8,
              border: `1px solid ${done ? '#22c55e' : '#f97316'}`,
              background: done ? '#f0fdf4' : '#fff7ed',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontWeight: 600 }}>
                {done
                  ? <><CheckCircle size={16} style={{ color: '#22c55e' }} /> {result.added} products added successfully</>
                  : <><AlertCircle size={16} style={{ color: '#f97316' }} /> Import had issues</>
                }
              </div>

              {result.skipped > 0 && (
                <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 6 }}>
                  {result.skipped} rows skipped — see details below:
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 11 }}>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', color: '#7c2d12' }}>
                      <strong>Row {err.row}</strong>{err.product ? ` — ${err.product}` : ''}: {err.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              id="start-import-btn"
              className="btn btn-primary"
              disabled={!file || importMutation.isPending}
              onClick={() => importMutation.mutate()}
              style={{ gap: 6 }}
            >
              {importMutation.isPending ? (
                <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Importing...</>
              ) : (
                <><Upload size={13} /> Import Products</>
              )}
            </button>
          )}
          {done && (
            <button className="btn btn-primary" onClick={() => { setFile(null); setResult(null); }}>
              Import Another File
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
