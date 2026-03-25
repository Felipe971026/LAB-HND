import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: any;
const SETTINGS_COLLECTION = 'app_settings';
const GOOGLE_TOKENS_DOC = 'google_drive_tokens';

async function initializeFirestore() {
  try {
    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let projectId = undefined;
    let dbId = undefined;

    if (fs.existsSync(firebaseConfigPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
      projectId = firebaseConfig.projectId;
      dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)' 
        ? firebaseConfig.firestoreDatabaseId 
        : undefined;
    }
    
    console.log(`Initializing Firebase Admin. Config Project: ${projectId}, Database: ${dbId || '(default)'}`);

    // Force environment variables for all Google SDKs
    if (projectId) {
      process.env.GOOGLE_CLOUD_PROJECT = projectId;
      process.env.GCLOUD_PROJECT = projectId;
    }

    // Use the default app if possible
    let appInstance;
    if (admin.apps.length === 0) {
      console.log('Initializing new Firebase app...');
      appInstance = admin.initializeApp({
        projectId: projectId,
      });
    } else {
      appInstance = admin.app();
      console.log('Using existing Firebase app');
    }

    const actualProjectId = appInstance.options.projectId;
    console.log(`Actual Firebase App Project ID: ${actualProjectId}`);

    // Try to initialize Firestore with retries
    const tryConnect = async (targetDbId: string | undefined) => {
      console.log(`Attempting to connect to database: ${targetDbId || '(default)'} in project ${actualProjectId}`);
      const testDb = targetDbId ? getFirestore(appInstance, targetDbId) : getFirestore(appInstance);
      // Verify connection with a simple call
      await testDb.listCollections();
      return testDb;
    };

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000;

    while (retryCount < maxRetries) {
      try {
        db = await tryConnect(dbId);
        console.log(`Successfully connected to database: ${dbId || '(default)'}`);
        break;
      } catch (err: any) {
        retryCount++;
        console.warn(`Attempt ${retryCount} failed to connect to ${dbId || '(default)'} database: ${err.message} (Code: ${err.code})`);
        
        if (retryCount < maxRetries) {
          console.log(`Retrying in ${retryDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          // If named failed after retries, try default as fallback
          if (dbId) {
            console.log('Falling back to default database...');
            try {
              db = await tryConnect(undefined);
              console.log('Successfully connected to default database (fallback)');
            } catch (fallbackErr: any) {
              console.error('Failed to connect to default database as well:', fallbackErr.message);
              // Still assign it so the app has an instance to try with
              db = getFirestore(appInstance);
            }
          } else {
            console.error('Default database connection failed. Firestore might not be enabled or project ID is incorrect.');
            db = getFirestore(appInstance);
          }
        }
      }
    }
  } catch (error) {
    console.error('Critical error during Firestore initialization:', error);
    // Final desperate fallback
    try {
      if (!admin.apps.length) admin.initializeApp();
      db = getFirestore();
    } catch (e) {
      console.error('Final Firestore fallback failed:', e);
    }
  }
}

// Call initialization
// initializeFirestore(); // Moved to startServer for better control

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Debug Firestore connection
app.get('/api/debug/firestore', async (req, res) => {
  try {
    const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    
    const debugInfo: any = {
      configProjectId: firebaseConfig.projectId,
      configDbId: firebaseConfig.firestoreDatabaseId,
      envProjectId: process.env.GOOGLE_CLOUD_PROJECT,
      apps: admin.apps.map(app => ({ name: app?.name, projectId: app?.options.projectId })),
      dbInitialized: !!db,
    };

    if (db) {
      try {
        const collections = await db.listCollections();
        debugInfo.collections = collections.map((c: any) => c.id);
        debugInfo.connectionSuccess = true;
      } catch (e: any) {
        debugInfo.connectionError = e.message;
        debugInfo.connectionErrorCode = e.code;
      }
    }

    res.json(debugInfo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- MOCK GOOGLE AUTH & SHEETS ENDPOINTS ---
// The user requested to temporarily remove all Google Sheets/Drive logic
// to focus on frontend and Firebase development without console errors.

// Auth URL endpoint (Mock)
app.get(['/api/auth/url', '/api/auth/google/url'], (req, res) => {
  try {
    const origin = req.get('origin') || req.get('referer');
    let baseUrl = process.env.APP_URL;
    if (origin) {
      try {
        const url = new URL(origin);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch (e) {}
    }
    // Return a URL that points to our mock callback
    res.json({ url: `${baseUrl}/auth/google/callback` });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar la URL de autenticación' });
  }
});

// Auth callback endpoint (Mock)
app.get('/auth/google/callback', async (req, res) => {
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Autenticación simulada exitosa. Esta ventana se cerrará automáticamente.</p>
      </body>
    </html>
  `);
});

// Check if connected (Mock)
app.get('/api/auth/google/status', async (req, res) => {
  // Return true so the UI thinks it's connected and doesn't show errors
  res.json({ connected: true });
});

// Disconnect (Mock)
app.post('/api/auth/google/logout', async (req, res) => {
  res.json({ success: true });
});

// Sync to Sheets (Pre-transfusional) (Mock)
app.post('/api/sync/sheets', async (req, res) => {
  console.log('Mock sync to sheets (Pre-transfusional):', req.body.unitId);
  res.json({ success: true, spreadsheetId: 'mock-spreadsheet-id' });
});

// Sync Reception to Sheets (Mock)
app.post('/api/sync/sheets/recepcion', async (req, res) => {
  console.log('Mock sync to sheets (Recepcion):', req.body.records?.length, 'records');
  res.json({ success: true, spreadsheetId: 'mock-spreadsheet-id' });
});

// Sync Use to Sheets (Mock)
app.post('/api/sync/sheets/uso', async (req, res) => {
  console.log('Mock sync to sheets (Uso):', req.body.unitId);
  res.json({ success: true, spreadsheetId: 'mock-spreadsheet-id' });
});

// Sync Disposition to Sheets (Mock)
app.post('/api/sync/sheets/disposicion', async (req, res) => {
  console.log('Mock sync to sheets (Disposicion):', req.body.unitId);
  res.json({ success: true, spreadsheetId: 'mock-spreadsheet-id' });
});
// --- END MOCK ENDPOINTS ---

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    details: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

async function startServer() {
  try {
    // Await Firestore initialization before starting the server
    await initializeFirestore();

    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1); // Exit on fatal error to avoid cyclic restarts if it's a crash loop
  }
}

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
