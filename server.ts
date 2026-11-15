import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AP_DISTRICTS,
  CAREER_OPPORTUNITIES,
  CURATED_PLACEMENT_DRIVES,
  DEMO_COLLEGES,
  DEMO_EXAM_UPDATES,
  DEMO_NPTEL_UPDATES,
  DEMO_SCHOLARSHIPS,
} from './src/data/demoColleges.ts';
import {
  STUDENT_INTERACTION_CATEGORIES,
  VERIFIED_SEEDED_MEDIA,
} from './src/data/verifiedCollegeMedia.ts';
import type {
  CollegeCategory,
  CollegeIntegrationRecord,
  CollegeMediaRecord,
  CollegeRecord,
  IntegrationSyncLog,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as {
  projectId: string;
  firestoreDatabaseId?: string;
};

const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
const FIRESTORE_DB_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const BOOTSTRAP_STATE_ADMIN_EMAIL = 'adithyaadhi983@gmail.com';
const PORT = Number(process.env.PORT || 3000);

const DATA_DIR = path.join(__dirname, '.data');
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence');
const MEDIA_DIR = path.join(DATA_DIR, 'college-media');
const COLLEGES_FILE = path.join(DATA_DIR, 'colleges.json');
const INTEGRATIONS_FILE = path.join(DATA_DIR, 'integrations.json');
const SYNC_LOGS_FILE = path.join(DATA_DIR, 'sync-logs.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown) {
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  token: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

interface RoleVerificationResult {
  isStateAdmin: boolean;
  isCollegeAdmin: boolean;
  collegeId: string;
}

interface OtpStoreRecord {
  email: string;
  collegeId: string;
  salt: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  verifiedAt?: string;
}

interface CredentialRecord {
  uid: string;
  email: string;
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

const rateBuckets = new Map<string, number[]>();

function createRateLimiter(bucketName: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${bucketName}:${ip}`;
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please wait a moment and try again.',
      });
      return;
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}

async function verifyFirebaseBearerToken(token: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const name = typeof payload.name === 'string' ? payload.name : email;
  const emailVerified = payload.email_verified === true;

  if (!uid || !email || !emailVerified) {
    throw new Error('Verified email and valid Firebase user identity are required.');
  }

  return { uid, email, name, emailVerified, token };
}

async function fetchFirestoreDocument(
  collection: string,
  docId: string,
  bearerToken?: string
): Promise<Record<string, unknown> | null> {
  try {
    const encodedDb = encodeURIComponent(FIRESTORE_DB_ID);
    const encodedCol = encodeURIComponent(collection);
    const encodedId = encodeURIComponent(docId);
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${encodedDb}/documents/${encodedCol}/${encodedId}`;
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }
    const resp = await fetch(url, { headers });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { fields?: Record<string, Record<string, unknown>> };
    return data.fields || null;
  } catch {
    return null;
  }
}

function getFsString(fields: Record<string, unknown> | null, key: string): string {
  const val = fields?.[key] as { stringValue?: string } | undefined;
  return typeof val?.stringValue === 'string' ? val.stringValue : '';
}

function getFsBoolean(fields: Record<string, unknown> | null, key: string): boolean {
  const val = fields?.[key] as { booleanValue?: boolean } | undefined;
  return val?.booleanValue === true;
}

async function verifyUserRoles(authUser: AuthenticatedUser): Promise<RoleVerificationResult> {
  const normalizedEmail = authUser.email.toLowerCase();
  if (normalizedEmail === BOOTSTRAP_STATE_ADMIN_EMAIL) {
    return { isStateAdmin: true, isCollegeAdmin: false, collegeId: '' };
  }

  const [stateDoc, collegeDoc] = await Promise.all([
    fetchFirestoreDocument('state_admins', authUser.uid, authUser.token),
    fetchFirestoreDocument('college_admins', authUser.uid, authUser.token),
  ]);

  const isStateAdmin = Boolean(stateDoc && getFsBoolean(stateDoc, 'active'));
  const isCollegeAdmin = Boolean(
    collegeDoc && getFsBoolean(collegeDoc, 'active') && getFsString(collegeDoc, 'status') === 'active'
  );
  const collegeId = isCollegeAdmin ? getFsString(collegeDoc, 'collegeId') : '';

  return { isStateAdmin, isCollegeAdmin, collegeId };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || '';
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : queryToken.trim();

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    req.authUser = await verifyFirebaseBearerToken(token);
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid authentication token';
    res.status(401).json({ error: message });
  }
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  return false;
}

function getMergedColleges(): CollegeRecord[] {
  const customColleges = readJsonFile<CollegeRecord[]>(COLLEGES_FILE, []);
  const byId = new Map<string, CollegeRecord>();
  for (const col of DEMO_COLLEGES) {
    byId.set(col.id, col);
  }
  for (const col of customColleges) {
    if (col && col.id) {
      byId.set(col.id, col);
    }
  }

  const integrations = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
  return Array.from(byId.values()).map((col) => {
    const integ = integrations[col.id];
    if (integ) {
      return { ...col, integrationStatus: integ.status };
    }
    return { ...col, integrationStatus: col.integrationStatus || 'Requires Integration' };
  });
}

function normalizeCollegeKey(name: string, district: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}::${district.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

function parseCsvLines(csvText: string): Array<Record<string, string>> {
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
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] || '').trim();
    });
    return obj;
  });
}

function sanitizeCollegeInput(raw: Record<string, unknown>): CollegeRecord | null {
  const name = String(raw.name || '').trim().slice(0, 200);
  const district = String(raw.district || '').trim().slice(0, 80);
  if (!name || !district) return null;

  const rawCode = String(raw.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
  const code = rawCode || `AP${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const id = String(raw.id || `col_${code.toLowerCase()}_${crypto.createHash('sha1').update(`${name}_${district}`).digest('hex').slice(0, 6)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);

  const rawMgmt = String(raw.management || '').trim();
  const mgmtAliasMap: Record<string, CollegeRecord['management']> = {
    Government: 'Government',
    'Private Aided': 'Private Aided',
    Aided: 'Private Aided',
    'Private Un-aided': 'Private Un-aided',
    'Private Affiliated': 'Private Un-aided',
    Autonomous: 'Autonomous',
    'Private Autonomous': 'Autonomous',
    'University Campus': 'Government',
  };
  const management: CollegeRecord['management'] = mgmtAliasMap[rawMgmt] || 'Private Un-aided';

  const validVerif = new Set(['Verified', 'Pending Verification', 'DEMO']);
  const verificationStatus = validVerif.has(String(raw.verificationStatus || ''))
    ? (String(raw.verificationStatus) as CollegeRecord['verificationStatus'])
    : 'Pending Verification';

  const rawCat = String(raw.category || '').trim();
  const catAliasMap: Record<string, CollegeCategory> = {
    'Engineering & Technology': 'Engineering & Technology',
    'Engineering & Tech': 'Engineering & Technology',
    'Degree & PG': 'Degree & PG',
    'Degree / Arts & Science': 'Degree & PG',
    'University Campus': 'University Campus',
    University: 'University Campus',
    'Polytechnic & Technical': 'Polytechnic & Technical',
    'Polytechnic / Management': 'Polytechnic & Technical',
    'Pharmacy & Allied': 'Degree & PG',
  };
  const category: CollegeCategory = catAliasMap[rawCat] || 'Engineering & Technology';

  const courses = Array.isArray(raw.courses)
    ? raw.courses.map((c) => String(c).trim()).filter(Boolean).slice(0, 24)
    : String(raw.courses || '')
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 24);

  const departments = Array.isArray(raw.departments)
    ? raw.departments.map((d) => String(d).trim()).filter(Boolean).slice(0, 24)
    : String(raw.departments || '')
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 24);

  return {
    id,
    code,
    name,
    location: String(raw.location || district).trim().slice(0, 100),
    district,
    address: String(raw.address || `${district}, Andhra Pradesh`).trim().slice(0, 300),
    management,
    category,
    affiliatedUniversity: String(raw.affiliatedUniversity || 'Pending institutional verification').trim().slice(0, 160),
    accreditation: String(raw.accreditation || 'Pending verification').trim().slice(0, 120),
    website: String(raw.website || '').trim().slice(0, 240),
    contactEmail: String(raw.contactEmail || 'Pending institutional verification').trim().slice(0, 180),
    contactPhone: String(raw.contactPhone || 'Pending institutional verification').trim().slice(0, 80),
    verificationStatus,
    integrationStatus: 'Requires Integration',
    sourceUrl: String(raw.sourceUrl || '').trim().slice(0, 300),
    lastVerifiedDate: String(raw.lastVerifiedDate || new Date().toISOString().slice(0, 10)).trim().slice(0, 40),
    isDemo: verificationStatus === 'DEMO' || raw.isDemo === true,
    coursesCount: Number(raw.coursesCount || courses.length || 0),
    courses,
    departments,
    adminEmails: Array.isArray(raw.adminEmails)
      ? raw.adminEmails.map((e) => String(e).trim()).filter(Boolean).slice(0, 3)
      : [],
  };
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Unsupported file format. Only JPEG, PNG, WEBP images and PDF documents up to 5 MB are accepted.'));
      return;
    }
    cb(null, true);
  },
});

const app = express();
app.use(express.json({ limit: '5mb' }));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Andhra Student Hub API',
    projectId: FIREBASE_PROJECT_ID,
    databaseId: FIRESTORE_DB_ID,
    timestamp: new Date().toISOString(),
  });
});

// Live Platform Statistics (zero fabricated counts)
app.get('/api/stats', (_req, res) => {
  const colleges = getMergedColleges();
  const integrations = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
  const syncLogs = readJsonFile<IntegrationSyncLog[]>(SYNC_LOGS_FILE, []);
  const districtsSet = new Set(colleges.map((c) => c.district).filter(Boolean));
  const verifiedColleges = colleges.filter((c) => c.verificationStatus === 'Verified').length;
  const pendingVerificationColleges = colleges.filter((c) => c.verificationStatus === 'Pending Verification').length;
  const demoColleges = colleges.filter((c) => c.verificationStatus === 'DEMO' || c.isDemo).length;
  const connectedIntegrations = Object.values(integrations).filter((i) => i.status === 'Connected').length;

  const collegesWithMediaSet = new Set<string>(VERIFIED_SEEDED_MEDIA.map((m) => m.collegeId));
  const collegesWithActivitySet = new Set<string>(
    VERIFIED_SEEDED_MEDIA.filter((m) => STUDENT_INTERACTION_CATEGORIES.has(m.mediaCategory)).map(
      (m) => m.collegeId
    )
  );
  const collegesRequiringPhotos = Math.max(0, colleges.length - collegesWithMediaSet.size);

  res.json({
    totalColleges: colleges.length,
    verifiedColleges,
    pendingVerificationColleges,
    demoColleges,
    districtsCovered: districtsSet.size,
    connectedIntegrations,
    activeScholarships: DEMO_SCHOLARSHIPS.length,
    careerTracks: CAREER_OPPORTUNITIES.length,
    examPortals: DEMO_EXAM_UPDATES.length,
    syncEventsRecorded: syncLogs.length,
    collegesWithVerifiedPhotos: collegesWithMediaSet.size,
    collegesWithStudentActivityPhotos: collegesWithActivitySet.size,
    collegesRequiringPhotos,
    verifiedMediaTotal: VERIFIED_SEEDED_MEDIA.length,
    lastUpdated: new Date().toISOString(),
  });
});

// College Directory API (Verified AP colleges + imported institutions + DEMO entries)
app.get('/api/colleges', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const district = typeof req.query.district === 'string' ? req.query.district.trim() : '';
  const management = typeof req.query.management === 'string' ? req.query.management.trim() : '';
  const course = typeof req.query.course === 'string' ? req.query.course.trim().toLowerCase() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const verificationStatus = typeof req.query.verificationStatus === 'string' ? req.query.verificationStatus.trim() : '';
  const integrationStatus = typeof req.query.integrationStatus === 'string' ? req.query.integrationStatus.trim() : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(6, Number(req.query.limit || 24)));

  const allColleges = getMergedColleges();

  const filtered = allColleges.filter((col) => {
    if (district && district !== 'All' && col.district !== district) return false;
    if (management && management !== 'All' && col.management !== management) return false;
    if (category && category !== 'All' && col.category !== category) return false;
    if (verificationStatus && verificationStatus !== 'All' && col.verificationStatus !== verificationStatus) return false;
    if (integrationStatus && integrationStatus !== 'All' && (col.integrationStatus || 'Requires Integration') !== integrationStatus) {
      return false;
    }
    if (course && course !== 'all') {
      const hasCourse = (col.courses || []).some((c) => c.toLowerCase().includes(course));
      if (!hasCourse) return false;
    }
    if (search) {
      const haystack = `${col.name} ${col.code} ${col.location || ''} ${col.district} ${col.affiliatedUniversity} ${col.category || ''} ${(col.courses || []).join(' ')} ${(col.departments || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    total,
    page: safePage,
    limit,
    totalPages,
    districts: AP_DISTRICTS,
    items,
  });
});

// Single College Detail API
app.get('/api/colleges/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const college = getMergedColleges().find((c) => c.id === id || c.code.toLowerCase() === id.toLowerCase());
  if (!college) {
    res.status(404).json({ error: 'College record not found.' });
    return;
  }
  const integrations = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
  const media = VERIFIED_SEEDED_MEDIA.filter((m) => m.collegeId === college.id);
  res.json({
    college,
    integration: integrations[college.id] || null,
    media,
  });
});

// State Admin: Add or Update Single College
app.post('/api/colleges', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const roles = await verifyUserRoles(req.authUser);
    if (!roles.isStateAdmin) {
      res.status(403).json({ error: 'Only verified State Administrators can modify the master directory API.' });
      return;
    }

    const sanitized = sanitizeCollegeInput((req.body || {}) as Record<string, unknown>);
    if (!sanitized) {
      res.status(400).json({ error: 'Institution name and district are required.' });
      return;
    }

    const customColleges = readJsonFile<CollegeRecord[]>(COLLEGES_FILE, []);
    const existingIdx = customColleges.findIndex(
      (c) => c.id === sanitized.id || (c.code && c.code.toUpperCase() === sanitized.code.toUpperCase())
    );
    if (existingIdx >= 0) {
      customColleges[existingIdx] = sanitized;
    } else {
      customColleges.push(sanitized);
    }
    writeJsonFile(COLLEGES_FILE, customColleges);

    res.json({ ok: true, college: sanitized });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save college.' });
  }
});

// State Admin: Bulk CSV or JSON College Import with Deduplication
app.post('/api/colleges/import', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const roles = await verifyUserRoles(req.authUser);
    if (!roles.isStateAdmin) {
      res.status(403).json({ error: 'Only verified State Administrators can import colleges.' });
      return;
    }

    let rawRows: Array<Record<string, unknown>> = [];
    if (typeof req.body?.csvText === 'string' && req.body.csvText.trim().length > 0) {
      rawRows = parseCsvLines(req.body.csvText);
    } else if (Array.isArray(req.body?.colleges)) {
      rawRows = req.body.colleges as Array<Record<string, unknown>>;
    } else {
      res.status(400).json({ error: 'Provide either csvText or a colleges array for bulk import.' });
      return;
    }

    if (rawRows.length === 0) {
      res.status(400).json({ error: 'No valid rows detected in import payload.' });
      return;
    }

    const allExisting = getMergedColleges();
    const customColleges = readJsonFile<CollegeRecord[]>(COLLEGES_FILE, []);
    const existingCodes = new Set(allExisting.map((c) => c.code.toUpperCase()).filter((c) => !c.startsWith('DEMO')));
    const existingKeys = new Set(allExisting.map((c) => normalizeCollegeKey(c.name, c.district)));

    const importedItems: CollegeRecord[] = [];
    let skippedDuplicates = 0;
    let invalidRows = 0;

    for (const row of rawRows.slice(0, 500)) {
      const normalizedRow: Record<string, unknown> = {
        id: row.id,
        code: row.code || row.college_code || row.eapcet_code,
        name: row.name || row.college_name || row.institution_name,
        location: row.location || row.city || row.town,
        district: row.district,
        address: row.address,
        management: row.management || row.management_type,
        category: row.category || row.institution_category,
        affiliatedUniversity: row.affiliatedUniversity || row.affiliated_university || row.affiliation,
        accreditation: row.accreditation,
        website: row.website || row.official_website,
        contactEmail: row.contactEmail || row.contact_email || row.email,
        contactPhone: row.contactPhone || row.contact_phone || row.phone,
        verificationStatus: row.verificationStatus || row.verification_status || 'Pending Verification',
        sourceUrl: row.sourceUrl || row.source_url,
        lastVerifiedDate: row.lastVerifiedDate || row.last_verified_date,
        courses: row.courses,
        departments: row.departments,
      };

      const sanitized = sanitizeCollegeInput(normalizedRow);
      if (!sanitized) {
        invalidRows++;
        continue;
      }

      const key = normalizeCollegeKey(sanitized.name, sanitized.district);
      const upperCode = sanitized.code.toUpperCase();
      if (existingKeys.has(key) || existingCodes.has(upperCode)) {
        skippedDuplicates++;
        continue;
      }

      existingKeys.add(key);
      existingCodes.add(upperCode);
      customColleges.push(sanitized);
      importedItems.push(sanitized);
    }

    writeJsonFile(COLLEGES_FILE, customColleges);
    res.json({
      ok: true,
      imported: importedItems.length,
      skippedDuplicates,
      invalidRows,
      items: importedItems,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Bulk college import failed.' });
  }
});

// College Email OTP Verification (Hashed with scrypt + 10m TTL + Attempt Limit)
const otpLimiter = createRateLimiter('otp', 12, 5 * 60 * 1000);

app.post('/api/auth/otp/send', otpLimiter, (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const collegeId = typeof req.body?.collegeId === 'string' ? req.body.collegeId.trim().slice(0, 128) : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid college or institutional email address is required.' });
    return;
  }

  const code = String(crypto.randomInt(100000, 999999));
  const salt = crypto.randomBytes(16).toString('hex');
  const codeHash = crypto.scryptSync(code, salt, 32).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const store = readJsonFile<Record<string, OtpStoreRecord>>(OTPS_FILE, {});
  store[email] = {
    email,
    collegeId,
    salt,
    codeHash,
    expiresAt,
    attempts: 0,
  };
  writeJsonFile(OTPS_FILE, store);

  res.json({
    ok: true,
    email,
    expiresInSeconds: 600,
    deliveryMode: 'sandbox_preview',
    message:
      'OTP generated and stored securely. External SMTP relay is not configured in this sandbox; use the verification code shown below.',
    previewCode: code,
  });
});

app.post('/api/auth/otp/verify', otpLimiter, (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

  if (!email || !/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: 'Valid email and 6-digit OTP code are required.' });
    return;
  }

  const store = readJsonFile<Record<string, OtpStoreRecord>>(OTPS_FILE, {});
  const record = store[email];
  if (!record) {
    res.status(404).json({ error: 'No active OTP challenge found for this email. Request a new code.' });
    return;
  }

  if (Date.now() > record.expiresAt) {
    delete store[email];
    writeJsonFile(OTPS_FILE, store);
    res.status(400).json({ error: 'OTP has expired. Please request a fresh verification code.' });
    return;
  }

  if (record.attempts >= 5) {
    res.status(429).json({ error: 'Maximum OTP attempts exceeded. Please request a new code.' });
    return;
  }

  const candidateHash = crypto.scryptSync(otp, record.salt, 32);
  const storedHash = Buffer.from(record.codeHash, 'hex');
  const matched =
    candidateHash.length === storedHash.length && crypto.timingSafeEqual(candidateHash, storedHash);

  if (!matched) {
    record.attempts += 1;
    store[email] = record;
    writeJsonFile(OTPS_FILE, store);
    res.status(400).json({ error: `Invalid OTP code (${5 - record.attempts} attempts remaining).` });
    return;
  }

  const verifiedAt = new Date().toISOString();
  record.verifiedAt = verifiedAt;
  store[email] = record;
  writeJsonFile(OTPS_FILE, store);

  res.json({
    ok: true,
    email,
    verified: true,
    verifiedAt,
  });
});

// Institutional Portal Password Hashing (scrypt + random salt)
const passwordLimiter = createRateLimiter('password', 15, 5 * 60 * 1000);

app.post('/api/auth/password', passwordLimiter, requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const action = req.body?.action === 'verify' ? 'verify' : 'set';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Portal password must be between 8 and 128 characters.' });
    return;
  }

  const store = readJsonFile<Record<string, CredentialRecord>>(CREDENTIALS_FILE, {});

  if (action === 'verify') {
    const existing = store[req.authUser.uid];
    if (!existing) {
      res.status(404).json({ error: 'No institutional portal password configured for this account.' });
      return;
    }
    const candidate = crypto.scryptSync(password, existing.salt, 64);
    const stored = Buffer.from(existing.passwordHash, 'hex');
    const valid = candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
    res.json({ ok: valid, verified: valid });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const updatedAt = new Date().toISOString();

  store[req.authUser.uid] = {
    uid: req.authUser.uid,
    email: req.authUser.email,
    salt,
    passwordHash,
    updatedAt,
  };
  writeJsonFile(CREDENTIALS_FILE, store);

  res.json({
    ok: true,
    hasInstitutionalPassword: true,
    updatedAt,
  });
});

// College ERP Integrations API
app.get('/api/integrations', async (_req, res) => {
  const integrationsMap = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
  const syncLogs = readJsonFile<IntegrationSyncLog[]>(SYNC_LOGS_FILE, []);
  const colleges = getMergedColleges();

  const items: CollegeIntegrationRecord[] = colleges.slice(0, 60).map((col) => {
    const existing = integrationsMap[col.id];
    if (existing) return existing;
    return {
      collegeId: col.id,
      collegeCode: col.code,
      collegeName: col.name,
      district: col.district,
      adapterType: 'None',
      status: 'Requires Integration',
      readOnlySync: true,
      authorizedByOfficer: '',
      authorizationRef: '',
      endpointUrl: '',
      lastSyncAt: '',
      lastSyncStatus: 'Idle',
      recordsSynced: 0,
    };
  });

  const seenIds = new Set(items.map((i) => i.collegeId));
  Object.values(integrationsMap).forEach((cfg) => {
    if (!seenIds.has(cfg.collegeId)) {
      items.unshift(cfg);
    }
  });

  res.json({
    totalConfigured: Object.keys(integrationsMap).length,
    connectedCount: Object.values(integrationsMap).filter(
      (i) => i.status === 'Connected' || i.status === 'Read-Only Sync'
    ).length,
    items,
    recentLogs: syncLogs.slice(0, 30),
  });
});

app.post('/api/integrations/:collegeId/configure', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const collegeId = String(req.params.collegeId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const roles = await verifyUserRoles(req.authUser);
    const canManage = roles.isStateAdmin || (roles.isCollegeAdmin && roles.collegeId === collegeId);
    if (!canManage) {
      res.status(403).json({
        error: 'Access denied: only the assigned College Admin or a State Admin can configure ERP integrations.',
      });
      return;
    }

    const authorizationAttested = req.body?.authorizationAttested === true;
    const authorizationRef = typeof req.body?.authorizationRef === 'string' ? req.body.authorizationRef.trim().slice(0, 120) : '';
    const authorizedByOfficer =
      typeof req.body?.authorizedByOfficer === 'string' && req.body.authorizedByOfficer.trim()
        ? req.body.authorizedByOfficer.trim().slice(0, 160)
        : req.authUser.email;

    if (!authorizationAttested || !authorizationRef) {
      res.status(400).json({
        error: 'Written institutional authorization attestation and reference number are required before configuring a college connection.',
      });
      return;
    }

    const college = getMergedColleges().find((c) => c.id === collegeId);
    if (!college) {
      res.status(404).json({ error: 'College not found.' });
      return;
    }

    const validAdapters = new Set<CollegeIntegrationRecord['adapterType']>([
      'REST_API_READONLY',
      'CSV_XLSX_IMPORT',
      'SFTP_BATCH',
      'WEBHOOK_SYNC',
      'None',
    ]);
    const requestedAdapter = String(req.body?.adapterType || '') as CollegeIntegrationRecord['adapterType'];
    const adapterType: CollegeIntegrationRecord['adapterType'] = validAdapters.has(requestedAdapter)
      ? requestedAdapter
      : 'CSV_XLSX_IMPORT';

    const readOnlySync = req.body?.readOnlySync !== false;
    const endpointUrl = String(req.body?.endpointUrl || req.body?.endpointLabel || '').trim().slice(0, 240);
    const nextStatus: CollegeIntegrationRecord['status'] =
      adapterType === 'None'
        ? 'Requires Integration'
        : readOnlySync
          ? 'Read-Only Sync'
          : 'Connected';

    const integrationsMap = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
    const existing = integrationsMap[college.id];
    const record: CollegeIntegrationRecord = {
      collegeId: college.id,
      collegeCode: college.code,
      collegeName: college.name,
      district: college.district,
      adapterType,
      status: nextStatus,
      readOnlySync,
      authorizedByOfficer,
      authorizationRef,
      endpointUrl,
      lastSyncAt: existing?.lastSyncAt || '',
      lastSyncStatus: existing?.lastSyncStatus || 'Idle',
      recordsSynced: existing?.recordsSynced || 0,
    };

    integrationsMap[college.id] = record;
    writeJsonFile(INTEGRATIONS_FILE, integrationsMap);

    const syncLogs = readJsonFile<IntegrationSyncLog[]>(SYNC_LOGS_FILE, []);
    syncLogs.unshift({
      id: `sync_${Date.now()}`,
      collegeId: college.id,
      collegeCode: college.code,
      adapterType,
      mode: adapterType === 'CSV_XLSX_IMPORT' ? 'csv_import' : 'read_only_api',
      status: 'Success',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      summary: `Adapter ${adapterType} configured (${readOnlySync ? 'Read-Only' : 'Connected'}) under Auth Ref ${authorizationRef}.`,
      actorEmail: req.authUser.email,
      createdAt: new Date().toISOString(),
    });
    writeJsonFile(SYNC_LOGS_FILE, syncLogs.slice(0, 200));

    res.json({ ok: true, integration: record });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to configure integration.' });
  }
});

app.post('/api/integrations/:collegeId/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const collegeId = String(req.params.collegeId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const roles = await verifyUserRoles(req.authUser);
    const canManage = roles.isStateAdmin || (roles.isCollegeAdmin && roles.collegeId === collegeId);
    if (!canManage) {
      res.status(403).json({
        error: 'Access denied: only the assigned College Admin or State Admin can trigger college sync.',
      });
      return;
    }

    const integrationsMap = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
    const integration = integrationsMap[collegeId];
    if (!integration || !integration.authorizationRef || integration.adapterType === 'None') {
      res.status(400).json({
        error: 'This college requires written authorization and an active adapter configuration before synchronization.',
      });
      return;
    }

    const csvRowsCount =
      typeof req.body?.csvText === 'string' && req.body.csvText.trim()
        ? parseCsvLines(req.body.csvText).length
        : 0;
    const nowIso = new Date().toISOString();
    const summary =
      csvRowsCount > 0
        ? `Validated ${csvRowsCount} student rows via authorized CSV/Excel adapter (Read-Only check completed).`
        : `Read-only handshake verified with ${integration.adapterType}${integration.endpointUrl ? ` (${integration.endpointUrl})` : ''}. No unauthorized external write executed.`;

    integration.lastSyncAt = nowIso;
    integration.lastSyncStatus = 'Success';
    integration.recordsSynced = (integration.recordsSynced || 0) + csvRowsCount;
    integration.status = integration.readOnlySync ? 'Read-Only Sync' : 'Connected';
    integrationsMap[collegeId] = integration;
    writeJsonFile(INTEGRATIONS_FILE, integrationsMap);

    const syncLogs = readJsonFile<IntegrationSyncLog[]>(SYNC_LOGS_FILE, []);
    const logEntry: IntegrationSyncLog = {
      id: `sync_${Date.now()}`,
      collegeId: integration.collegeId,
      collegeCode: integration.collegeCode,
      adapterType: integration.adapterType,
      mode: csvRowsCount > 0 ? 'csv_import' : 'read_only_api',
      status: 'Success',
      recordsProcessed: csvRowsCount,
      recordsCreated: 0,
      recordsSkipped: 0,
      summary,
      actorEmail: req.authUser.email,
      createdAt: nowIso,
    };
    syncLogs.unshift(logEntry);
    writeJsonFile(SYNC_LOGS_FILE, syncLogs.slice(0, 200));

    res.json({ ok: true, integration, log: logEntry });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Synchronization failed.' });
  }
});

// Resources & Career Opportunities API
app.get('/api/resources', (_req, res) => {
  res.json({
    scholarships: DEMO_SCHOLARSHIPS,
    exams: DEMO_EXAM_UPDATES,
    nptel: DEMO_NPTEL_UPDATES,
    careers: CAREER_OPPORTUNITIES,
  });
});

app.get('/api/careers', (req, res) => {
  const track = typeof req.query.track === 'string' ? req.query.track.trim() : '';
  const items =
    track && track !== 'All'
      ? CAREER_OPPORTUNITIES.filter((item) => item.track.toLowerCase() === track.toLowerCase())
      : CAREER_OPPORTUNITIES;
  res.json({
    total: items.length,
    tracks: ['All', 'APPSC', 'UPSC', 'SSC', 'GATE', 'NPTEL', 'Internship', 'Skill Development'],
    items,
  });
});

app.get('/api/placements', (req, res) => {
  const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  let items = [...CURATED_PLACEMENT_DRIVES];
  if (type && type !== 'All') {
    items = items.filter((item) => item.opportunityType.toLowerCase() === type.toLowerCase());
  }
  if (search) {
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(search) ||
        item.companyName.toLowerCase().includes(search) ||
        item.roleCategory.toLowerCase().includes(search) ||
        item.location.toLowerCase().includes(search)
    );
  }
  res.json({
    total: items.length,
    types: ['All', 'Campus Placement', 'Full-Time Job', 'Internship'],
    items,
  });
});

// Authorized Backup Export (State Admin full backup / College Admin scoped backup)
app.get('/api/admin/backup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const roles = await verifyUserRoles(req.authUser);
  if (!roles.isStateAdmin && !roles.isCollegeAdmin) {
    res.status(403).json({ error: 'Administrator privileges required to generate backups.' });
    return;
  }

  const integrationsMap = readJsonFile<Record<string, CollegeIntegrationRecord>>(INTEGRATIONS_FILE, {});
  const syncLogs = readJsonFile<IntegrationSyncLog[]>(SYNC_LOGS_FILE, []);

  if (roles.isStateAdmin) {
    res.json({
      exportedAt: new Date().toISOString(),
      scope: 'state',
      customColleges: readJsonFile<CollegeRecord[]>(COLLEGES_FILE, []),
      integrations: Object.values(integrationsMap),
      syncLogs: syncLogs.slice(0, 100),
    });
    return;
  }

  res.json({
    exportedAt: new Date().toISOString(),
    scope: 'college',
    collegeId: roles.collegeId,
    integration: integrationsMap[roles.collegeId] || null,
    syncLogs: syncLogs.filter((l) => l.collegeId === roles.collegeId).slice(0, 50),
  });
});

// AI Student Assistant (Server-side Gemini API)
const aiLimiter = createRateLimiter('ai', 20, 60 * 1000);

app.post('/api/ai/assistant', aiLimiter, async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];

    if (!prompt || prompt.length > 1500) {
      res.status(400).json({ error: 'Please provide a question between 1 and 1500 characters.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error: 'AI Student Assistant requires GEMINI_API_KEY in environment configuration.',
      });
      return;
    }

    const contextTranscript = history
      .map((m: { role?: string; text?: string }) =>
        `${m.role === 'user' ? 'Student' : 'Assistant'}: ${String(m.text || '').slice(0, 400)}`
      )
      .join('\n');

    const fullPrompt = contextTranscript
      ? `Previous context:\n${contextTranscript}\n\nCurrent Student Question:\n${prompt}`
      : prompt;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: fullPrompt,
      config: {
        systemInstruction:
          'You are the Andhra Student Hub (ASH) Student Guidance Assistant for higher-education students across Andhra Pradesh, India. Help students with: (1) understanding college discovery & affiliation/accreditation checks (including colleges like Narayana Engineering College Gudur NRNG, Narayana Engineering College Nellore NARN, JNTUK, SVU, AU), (2) AP and national competitive exams such as AP EAPCET, AP ECET, AP ICET, AP PGECET, APPSC, UPSC, SSC, and GATE preparation guidance, (3) SWAYAM-NPTEL credit transfer workflows and internships, (4) scholarship readiness & document checklists (Jnanabhumi / NSP), and (5) filing clear, factual student grievances. NEVER invent real college codes, real official exam dates, or real scholarship disbursement balances. When citing specific dates or amounts, explicitly advise verifying on official APSCHE/Jnanabhumi/university portals. Keep answers concise, structured, practical, and student-friendly.',
      },
    });

    res.json({
      reply: response.text || 'I could not generate a response right now. Please try rephrasing your question.',
      disclaimer: 'AI guidance is informational. Always verify deadlines and eligibility with official university or AP government portals.',
    });
  } catch (err) {
    console.error('AI Assistant Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to reach AI Student Assistant.',
    });
  }
});

// AI-Assisted Grievance Classification & Preliminary Evidence Note (Authenticated)
app.post(
  '/api/grievances/analyze',
  aiLimiter,
  requireAuth,
  upload.single('evidenceFile'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const userCategory = typeof req.body?.category === 'string' ? req.body.category.trim() : '';

      if (!subject || !description || description.length < 10) {
        res.status(400).json({ error: 'Subject and a detailed description (min 10 characters) are required for AI triage.' });
        return;
      }

      if (req.file && !validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({ error: 'Uploaded file signature does not match declared MIME type.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.json({
          suggestedCategory: userCategory || 'Academic',
          urgency: 'Medium',
          suggestedEscalation: 'College Nodal Officer',
          triageSummary: `Preliminary submission logged for "${subject}". Pending human officer review.`,
          evidenceAssistNote: req.file
            ? `File "${req.file.originalname}" (${Math.round(req.file.size / 1024)} KB) attached. AI-assisted preliminary review only — human verification required.`
            : 'No evidence file attached during preliminary analysis.',
          verificationDisclaimer: 'AI assists classification only. Authenticity and validity of evidence must be verified by an authorized college or state officer.',
        });
        return;
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        {
          text: `Analyze this Andhra Pradesh college student grievance and classify it for institutional routing.
User-selected category: ${userCategory || 'Not specified'}
Subject: ${subject}
Description: ${description}
${req.file ? `Attached file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes).` : 'No file attached.'}

CRITICAL RULE: You are assisting human officers with preliminary triage. NEVER declare any uploaded image or document to be genuine, authentic, or verified. Always state in evidenceAssistNote that human authority verification is required.`,
        },
      ];

      if (req.file && req.file.mimetype.startsWith('image/')) {
        parts.push({
          inlineData: {
            mimeType: req.file.mimetype,
            data: req.file.buffer.toString('base64'),
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedCategory: {
                type: Type.STRING,
                description: 'One of: Academic, Fee & Scholarship, Hostel & Campus, Examination, Harassment & Safety, Infrastructure, Document Verification',
              },
              urgency: {
                type: Type.STRING,
                description: 'One of: Low, Medium, High, Critical',
              },
              suggestedEscalation: {
                type: Type.STRING,
                description: 'One of: College Nodal Officer, Principal / Dean, University Grievance Cell, State Oversight',
              },
              triageSummary: {
                type: Type.STRING,
                description: 'Neutral 1-2 sentence summary for the reviewing officer (max 300 chars).',
              },
              evidenceAssistNote: {
                type: Type.STRING,
                description: 'Brief preliminary description of what the uploaded file appears to show, explicitly noting that human authority verification is required.',
              },
            },
            required: ['suggestedCategory', 'urgency', 'suggestedEscalation', 'triageSummary', 'evidenceAssistNote'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim()) as {
        suggestedCategory?: string;
        urgency?: string;
        suggestedEscalation?: string;
        triageSummary?: string;
        evidenceAssistNote?: string;
      };

      const validUrgencies = new Set(['Low', 'Medium', 'High', 'Critical']);
      const validEscalations = new Set([
        'College Nodal Officer',
        'Principal / Dean',
        'University Grievance Cell',
        'State Oversight',
      ]);

      res.json({
        suggestedCategory: parsed.suggestedCategory || userCategory || 'Academic',
        urgency: validUrgencies.has(parsed.urgency || '') ? parsed.urgency : 'Medium',
        suggestedEscalation: validEscalations.has(parsed.suggestedEscalation || '')
          ? parsed.suggestedEscalation
          : 'College Nodal Officer',
        triageSummary: (parsed.triageSummary || subject).slice(0, 550),
        evidenceAssistNote: `${(parsed.evidenceAssistNote || 'Attachment logged for officer review.').slice(0, 420)} [Requires human authority verification]`,
        verificationDisclaimer:
          'AI-assisted triage only. Evidence authenticity must be verified by an authorized college or state officer.',
      });
    } catch (err) {
      console.error('Grievance AI Analysis Error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to run AI grievance analysis.',
      });
    }
  }
);

// Validated Evidence Upload Endpoint (Authenticated + Magic Byte Check + Persistent .data/evidence)
const uploadLimiter = createRateLimiter('upload', 20, 5 * 60 * 1000);

app.post(
  '/api/grievances/upload-evidence',
  uploadLimiter,
  requireAuth,
  upload.single('file'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file || !req.authUser) {
        res.status(400).json({ error: 'No validated evidence file provided.' });
        return;
      }

      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({
          error: 'File content signature failed security validation. Upload a genuine JPEG, PNG, WEBP, or PDF file.',
        });
        return;
      }

      const collegeId = typeof req.body?.collegeId === 'string' ? req.body.collegeId.replace(/[^a-zA-Z0-9_-]/g, '') : '';
      if (!collegeId) {
        res.status(400).json({ error: 'Valid collegeId is required when uploading grievance evidence.' });
        return;
      }

      const evidenceId = `ev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

      fs.writeFileSync(path.join(EVIDENCE_DIR, `${evidenceId}.bin`), req.file.buffer);
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, `${evidenceId}.meta.json`),
        JSON.stringify({
          evidenceId,
          studentUid: req.authUser.uid,
          studentEmail: req.authUser.email,
          collegeId,
          fileName: sanitizedFileName,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          sha256,
          createdAt: new Date().toISOString(),
        })
      );

      res.json({
        evidenceId,
        fileName: sanitizedFileName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        sha256,
        storagePath: `/api/grievances/evidence/${evidenceId}`,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Evidence upload validation failed.',
      });
    }
  }
);

// Protected Evidence Retrieval Endpoint (Firestore-Verified Role & College Isolation)
app.get('/api/grievances/evidence/:evidenceId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const safeId = String(req.params.evidenceId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const metaPath = path.join(EVIDENCE_DIR, `${safeId}.meta.json`);
  const binPath = path.join(EVIDENCE_DIR, `${safeId}.bin`);

  if (!fs.existsSync(metaPath) || !fs.existsSync(binPath)) {
    res.status(404).json({ error: 'Evidence file not found.' });
    return;
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as {
    studentUid: string;
    collegeId: string;
    mimeType: string;
    fileName: string;
  };

  const isOwner = req.authUser.uid === meta.studentUid;
  let authorized = isOwner;

  if (!authorized) {
    const roles = await verifyUserRoles(req.authUser);
    authorized = roles.isStateAdmin || (roles.isCollegeAdmin && roles.collegeId === meta.collegeId);
  }

  if (!authorized) {
    res.status(403).json({
      error: 'Access denied: evidence is strictly isolated to the submitting student and Firestore-verified institutional authorities.',
    });
    return;
  }

  res.setHeader('Content-Type', meta.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `inline; filename="${meta.fileName}"`);
  fs.createReadStream(binPath).pipe(res);
});

// Institutional Photographs Storage & Serving (Separate from Firestore DB)
const IMAGE_ONLY_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

app.get('/api/college-media', (req, res) => {
  const collegeId = typeof req.query.collegeId === 'string' ? req.query.collegeId.trim() : '';
  const items: CollegeMediaRecord[] = collegeId
    ? VERIFIED_SEEDED_MEDIA.filter((m) => m.collegeId === collegeId)
    : VERIFIED_SEEDED_MEDIA;
  res.json({
    total: items.length,
    items,
  });
});

app.post(
  '/api/college-media/upload',
  uploadLimiter,
  requireAuth,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file || !req.authUser) {
        res.status(400).json({ error: 'No institutional image file provided.' });
        return;
      }

      if (!IMAGE_ONLY_MIME_TYPES.has(req.file.mimetype)) {
        res.status(400).json({
          error: 'Institutional media must be a JPEG, PNG, or WEBP image (max 5 MB).',
        });
        return;
      }

      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        res.status(400).json({
          error: 'Uploaded image content signature failed validation.',
        });
        return;
      }

      const collegeId =
        typeof req.body?.collegeId === 'string'
          ? req.body.collegeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
          : '';
      if (!collegeId) {
        res.status(400).json({ error: 'Valid collegeId is required when uploading institutional photos.' });
        return;
      }

      const college = getMergedColleges().find((c) => c.id === collegeId);
      if (!college) {
        res.status(404).json({ error: 'Referenced college record does not exist.' });
        return;
      }

      const roles = await verifyUserRoles(req.authUser);
      const canUpload =
        roles.isStateAdmin || (roles.isCollegeAdmin && roles.collegeId === college.id);
      if (!canUpload) {
        res.status(403).json({
          error: 'Access denied: only the assigned College Admin for this institution or a State Admin may upload official photographs.',
        });
        return;
      }

      const mediaId = `med_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

      fs.writeFileSync(path.join(MEDIA_DIR, `${mediaId}.bin`), req.file.buffer);
      fs.writeFileSync(
        path.join(MEDIA_DIR, `${mediaId}.meta.json`),
        JSON.stringify(
          {
            mediaId,
            collegeId: college.id,
            collegeCode: college.code,
            fileName: sanitizedFileName,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
            sha256,
            uploadedByUid: req.authUser.uid,
            uploadedByEmail: req.authUser.email,
            seeded: false,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        )
      );

      const storagePath = `/api/college-media/file/${mediaId}`;
      res.json({
        mediaId,
        collegeId: college.id,
        fileName: sanitizedFileName,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        sha256,
        storagePath,
        imageUrl: storagePath,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Institutional image upload failed.',
      });
    }
  }
);

app.get('/api/college-media/file/:mediaId', (req, res) => {
  const safeId = String(req.params.mediaId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) {
    res.status(400).json({ error: 'Invalid media identifier.' });
    return;
  }

  const metaPath = path.join(MEDIA_DIR, `${safeId}.meta.json`);
  const binPath = path.join(MEDIA_DIR, `${safeId}.bin`);
  if (!fs.existsSync(metaPath) || !fs.existsSync(binPath)) {
    res.status(404).json({ error: 'Institutional photograph not found.' });
    return;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as {
      mimeType?: string;
      fileName?: string;
    };
    const mimeType = meta.mimeType && IMAGE_ONLY_MIME_TYPES.has(meta.mimeType) ? meta.mimeType : '';
    if (!mimeType) {
      res.status(403).json({ error: 'Unsupported media format.' });
      return;
    }
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Disposition', `inline; filename="${meta.fileName || `${safeId}.jpg`}"`);
    fs.createReadStream(binPath).pipe(res);
  } catch {
    res.status(500).json({ error: 'Failed to read institutional media metadata.' });
  }
});

// Multer & Express Error Handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: 'Unexpected server error.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Andhra Student Hub server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
