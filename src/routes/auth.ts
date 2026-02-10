import express from 'express'
import { nanoid } from 'nanoid'
import dotenv from 'dotenv'
import { getUserByEmail, createUser } from '../firestoreDb'

dotenv.config()
const router = express.Router()

// POST /auth/send-magic-link { email }
// Note: frontend uses Firebase Email Link auth; this route will create a user doc if needed.
router.post('/send-magic-link', async (req, res) => {
  const { email, name, uid } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  // If uid provided (from Firebase client), use it as doc id; otherwise create a generated id
  const existing = await getUserByEmail(email)
  if (existing) return res.json({ ok: true, user: existing })

  const userId = uid || `u-${nanoid(8)}`
  const user = await createUser(userId, { email, name })
  return res.json({ ok: true, user })
})

export default router
