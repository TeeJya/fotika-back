import express from 'express'
import { generateId } from '../utils/generateId'
import { createEvent as dbCreateEvent, getEventBySlug, getUserById } from '../firestoreDb'
import { createOAuthClient, listImagesInFolder, getFileStream } from '../utils/googleDrive'
import { verifyFirebaseToken } from '../middleware/verifyFirebase'

const router = express.Router()

// POST /events - create event (protected)
router.post('/', verifyFirebaseToken, async (req: any, res) => {
  const { title, driveFolderId, visibility } = req.body
  const userId = req.user?.uid
  if (!title || !driveFolderId || !userId) return res.status(400).json({ error: 'missing fields' })

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + generateId(6)
  const event = await dbCreateEvent({ slug, title, driveFolderId, userId, public: (visibility !== 'private') })
  res.json({ ok: true, event })
})

// GET /events/:slug - public event metadata
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const event = await getEventBySlug(slug)
    if (!event) return res.status(404).json({ error: 'not found' })

    const user = await getUserById(event.userId)

    // If drive tokens are available, fetch image list (no caching)
    let images: any[] = []
    if (user && (user as any).driveTokens) {
      const folderId = event.driveFolderId
      
      const oauth = createOAuthClient()
      oauth.setCredentials((user as any).driveTokens)
      try {
        images = await listImagesInFolder(oauth, folderId)
        console.log(`Fetched images for ${folderId} from Drive`)
      } catch (err) {
        console.error('Drive list error', err)
        // Don't crash processing, just return empty images
      }
    }

    res.json({ event, images })
  } catch (error) {
    console.error('Error in /events/:slug:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /events/:slug/proxy/:fileId - proxy image content
router.get('/:slug/proxy/:fileId', async (req, res) => {
  try {
    const { slug, fileId } = req.params
    const event = await getEventBySlug(slug)
    if (!event) return res.status(404).json({ error: 'Event not found' })

    const user = await getUserById(event.userId)
    if (!user || !(user as any).driveTokens) {
      return res.status(404).json({ error: 'User or tokens not found' })
    }

    const oauth = createOAuthClient()
    oauth.setCredentials((user as any).driveTokens)

    try {
      const driveRes = await getFileStream(oauth, fileId)
      
      // forward headers
      const contentType = driveRes.headers['content-type']
      if (contentType) res.setHeader('Content-Type', contentType)
      const contentLength = driveRes.headers['content-length']
      if (contentLength) res.setHeader('Content-Length', contentLength)

      // Cache control - cache for 1 year immutable as drive file IDs are stable
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

      // pipe stream
      ;(driveRes.data as any).pipe(res)
    } catch (err: any) {
        console.error('Drive proxy error', err)
        const status = err.response?.status || 500
        const message = err.message || 'Unknown stream error'
        
        // Don't send JSON if headers were already sent or piping started
        if (!res.headersSent) {
             if (status === 403 || status === 404) {
                 return res.status(status).json({ error: 'Image not reachable on Drive', details: message })
             }
             return res.status(500).json({ error: 'Error proxying image', details: message })
        }
    }

  } catch (error: any) {
    console.error('Proxy error:', error)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

export default router
