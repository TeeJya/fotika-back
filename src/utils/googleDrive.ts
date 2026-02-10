import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env

export function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI
  )
}

export async function listImagesInFolder(auth: any, folderId: string) {
  const drive = google.drive({ version: 'v3', auth })
  // Query for files in folder and filter common image mime types
  const res = await drive.files.list({
    q: `'${folderId}' in parents and (mimeType contains 'image/') and trashed = false`,
    fields: 'files(id,name,mimeType,thumbnailLink,webContentLink)'
  })
  return res.data.files || []
}

export async function getFileStream(auth: any, fileId: string) {
  // Proxy stream
  const drive = google.drive({ version: 'v3', auth })
  const res = await drive.files.get({
    fileId,
    alt: 'media'
  }, { responseType: 'stream' })
  return res
}
