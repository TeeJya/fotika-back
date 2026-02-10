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
  console.log(`DEBUG: /drive/callback called with code=${!!code} state=${state}`);

  if (!code) return res.status(400).send('Missing code')
  
  try {
    const oauth2Client = createOAuthClient()
    console.log('DEBUG: Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code as string)
    console.log(`DEBUG: Tokens received (access_token=${!!tokens.access_token}, refresh_token=${!!tokens.refresh_token})`);
    
    oauth2Client.setCredentials(tokens)

    // persist tokens in Firestore linked to user id (state)
    if (state) {
      const userId = state as string;
      console.log(`DEBUG: Looking up user ${userId} to save tokens...`);
      const user = await getUserById(userId)
      if (user) {
        console.log(`DEBUG: Saving tokens for user ${userId}`);
        await saveUserDriveTokens(userId, tokens)
        console.log('DEBUG: Tokens saved successfully.');
      } else {
        console.warn(`DEBUG: User ${userId} NOT found. Tokens NOT saved.`);
      }
    } else {
        console.warn('DEBUG: No state (userId) provided in callback. Tokens NOT saved.');
    }

    // For MVP show a success page with next steps
    res.send('Drive connected. You can close this window and return to the app.')
  } catch (error: any) {
    console.error('DEBUG: Drive Callback Error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
})

export default router
