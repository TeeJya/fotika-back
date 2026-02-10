import admin from 'firebase-admin'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const svc = process.env.FIREBASE_SERVICE_ACCOUNT
let serviceAccount: any = undefined

function tryParseJson(s: string) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return null
  }
}

if (svc) {
  // If env value is a path to a file, read it
  try {
    if (fs.existsSync(svc) && fs.statSync(svc).isFile()) {
      const raw = fs.readFileSync(svc, 'utf8')
      serviceAccount = tryParseJson(raw)
    } else {
      // Try JSON parse directly
      serviceAccount = tryParseJson(svc)
      // Check if it's an empty object (from empty env var)
      if (serviceAccount && Object.keys(serviceAccount).length === 0) {
        serviceAccount = null
      }
      
      if (!serviceAccount) {
        // Try base64 decode then parse
        try {
          const decoded = Buffer.from(svc, 'base64').toString('utf8')
          serviceAccount = tryParseJson(decoded)
        } catch (e) {
          serviceAccount = null
        }
      }
    }
  } catch (e: any) {
    console.warn('Error reading FIREBASE_SERVICE_ACCOUNT:', e.message || e)
    serviceAccount = null
  }
}

// If parsed but missing project_id, try to fill from env vars
if (serviceAccount && !serviceAccount.project_id) {
  const projectFromEnv = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  if (projectFromEnv) {
    serviceAccount.project_id = projectFromEnv
    console.warn('FIREBASE_SERVICE_ACCOUNT missing project_id; set from env')
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT parsed but missing project_id; admin SDK may error')
  }
}

// Initialize admin SDK: prefer service account credential, fall back to ADC or Project ID
try {
  if (serviceAccount && Object.keys(serviceAccount).length > 0) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    } catch (e: any) {
      console.warn('Failed to init Firebase Admin with cert:', e.message || e)
      fallbackInit()
    }
  } else {
    fallbackInit()
  }
} catch (e: any) {
  console.warn('Firebase Admin init: no credentials provided or initialization failed; some features may not work.', e.message || e)
}

function fallbackInit() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT
  if (projectId) {
    console.log(`Initializing Firebase Admin with projectId: ${projectId}`)
    admin.initializeApp({ projectId })
  } else {
    console.warn('Falling back to application default credentials (no project ID found)')
    admin.initializeApp() 
  }
}

export default admin
