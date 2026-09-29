import { useRef, useState } from 'react';
import { File, FileImage, FileSpreadsheet, FileText, FileArchive, Upload, X } from 'lucide-react';

export const MAX_FILES = 10;
export const MAX_FILE_MB = 25;

function iconFor(file) {
  if (file.type.startsWith('image/')) return FileImage;
  if (file.type.includes('pdf') || /\.(docx?|txt|md)$/i.test(file.name)) return FileText;
  if (file.type.includes('sheet') || /\.(xlsx?|csv)$/i.test(file.name)) return FileSpreadsheet;
  if (/\.(zip|rar|7z)$/i.test(file.name)) return FileArchive;
  return File;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Drop zone + list. Rejects files over the size limit and duplicates (same name and size).
export default function FilePicker({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState('');

  const add = (incoming) => {
    const next = [...files];
    const problems = [];
    for (const file of incoming) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) problems.push(`${file.name} is over ${MAX_FILE_MB} MB`);
      else if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      else if (next.length >= MAX_FILES) problems.push(`Only ${MAX_FILES} files allowed`);
      else next.push(file);
    }
    setNotice([...new Set(problems)].join(' · '));
    onChange(next);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) add([...e.dataTransfer.files]);
  };

  return (
    <div className="file-picker">
      <button
        type="button"
        className={over ? 'drop-zone over' : 'drop-zone'}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <Upload size={18} />
        <span>
          <strong>Drop files here</strong> or click to browse
        </span>
        <span className="muted">Up to {MAX_FILES} files, {MAX_FILE_MB} MB each</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add([...e.target.files]);
          e.target.value = ''; // allow picking the same file again after removing it
        }}
      />
      {notice && <p className="form-error">{notice}</p>}
      {files.length > 0 && (
        <ul className="attachment-list picked">
          {files.map((file, i) => {
            const Icon = iconFor(file);
            return (
              <li key={`${file.name}-${file.size}`}>
                <Icon size={16} />
                <span className="attachment-name" title={file.name}>{file.name}</span>
                <span className="muted">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={disabled}
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  title={`Remove ${file.name}`}
                >
                  <X size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
