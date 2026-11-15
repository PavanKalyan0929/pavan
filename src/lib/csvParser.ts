import type { CollegeRecord } from '../types.ts';

export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).map((cols) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = (cols[idx] || '').trim();
    });
    return record;
  });
}

export function buildCollegeImportTemplateCsv(): string {
  const headers = [
    'code',
    'name',
    'location',
    'district',
    'address',
    'management',
    'category',
    'affiliated_university',
    'accreditation',
    'official_website',
    'contact_email',
    'contact_phone',
    'verification_status',
    'source_url',
    'courses',
    'departments',
  ];
  const sample = [
    'SAMPLE-ENG',
    'Example Engineering College',
    'Vijayawada',
    'NTR',
    'Sample Campus Road, Vijayawada, AP',
    'Autonomous',
    'Engineering & Technology',
    'JNTUK Kakinada',
    'NAAC A',
    'https://example.edu.in',
    'Pending institutional verification',
    'Pending institutional verification',
    'Pending Verification',
    'https://apsche.ap.gov.in',
    'B.Tech CSE|B.Tech ECE|B.Tech EEE',
    'Computer Science & Engineering|Electronics & Communication Engineering',
  ];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return `${headers.join(',')}\n${sample.map(escape).join(',')}\n`;
}

export function normalizeCollegeDedupKey(col: Pick<CollegeRecord, 'name' | 'district'>): string {
  return `${col.name.toLowerCase().replace(/[^a-z0-9]/g, '')}::${col.district.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}
