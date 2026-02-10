import express from 'express'
import { createOAuthClient } from '../utils/googleDrive'
import dotenv from 'dotenv'
import { getUserById, saveUserDriveTokens } from '../firestoreDb'

dotenv.config()
const router = express.Router()

// GET /drive/connect?userId=...
router.get('/connect', (req, res) => {
  const { userId } = req.query
  const oauth2Client = createOAuthClient()
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly']
  })
  // Pass state so callback can link tokens to userId
  res.redirect(url + `&state=${userId || ''}`)
})

// GET /drive/callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.status(400).send('Missing code')
  const oauth2Client = createOAuthClient()
  const { tokens } = await oauth2Client.getToken(code as string)
  oauth2Client.setCredentials(tokens)

  // persist tokens in Firestore linked to user id (state)
  if (state) {
    const user = await getUserById(state as string)
    if (user) {
      await saveUserDriveTokens(state as string, tokens)
    }
  }

  // For MVP show a success page with next steps
  res.send('Drive connected. You can close this window and return to the app.')
})

export default router
