import { bucket } from '../firebaseAdmin'
import { createOAuthClient, getFileStream } from './googleDrive'
import { getEventBySlug, getUserById, saveEventImages } from '../firestoreDb'

export async function syncEventImagesToStorage(slug: string) {
  const event = await getEventBySlug(slug)
  if (!event) throw new Error('Event not found')

  const user = await getUserById(event.userId)
  if (!user || !(user as any).driveTokens) throw new Error('User not connected to Drive')

  const oauth = createOAuthClient()
  oauth.setCredentials((user as any).driveTokens)

  // 1. List files again to get IDs (or pass them in, but better to re-fetch to be sure)
  // We need to import listImages from googleDrive or move it to shared.
  // For now let's assume we use the google drive list utility.
  // Wait, I can't import listImagesInFolder easily if it's not exported properly or cyclic.
  // It is exported in googleDrive.ts.
  const { listImagesInFolder } = require('./googleDrive'); 
  
  const files = await listImagesInFolder(oauth, event.driveFolderId)
  console.log(`Found ${files.length} files in Drive folder ${event.driveFolderId}`)

  const uploadedImages = []

  for (const file of files) {
    const destination = `events/${slug}/${file.id}`
    const fileRef = bucket.file(destination)
    
    // Check if exists
    const [exists] = await fileRef.exists()
    if (!exists) {
        console.log(`Downloading ${file.id} ...`)
        const stream = await getFileStream(oauth, file.id)
        
        await new Promise((resolve, reject) => {
            (stream.data as any)
                .pipe(fileRef.createWriteStream({
                    metadata: { contentType: file.mimeType }
                }))
                .on('finish', resolve)
                .on('error', reject)
        })
        console.log(`Uploaded ${file.id} to Storage`)
    } else {
        console.log(`Skipping ${file.id} (already exists)`)
    }
    
    // Make public or get signed URL? 
    // Ideally we make the file public and use the public URL.
    await fileRef.makePublic()
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`
    
    uploadedImages.push({
        id: file.id,
        name: file.name,
        url: publicUrl,
        thumbnail: publicUrl // We can generate a thumb or just use full res for now
    })
  }

  // Save to Firestore
  await saveEventImages(slug, uploadedImages)
  
  return uploadedImages
}
