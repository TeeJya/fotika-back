import { Request, Response, NextFunction } from 'express'
import admin from '../firebaseAdmin'

export async function verifyFirebaseToken(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const header = (req.headers.authorization as string) || ''
  const token = header.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.user = decoded
    next()
  } catch (err) {
    console.error('verifyFirebaseToken error', err)
    res.status(401).json({ error: 'Invalid token' })
  }
}
