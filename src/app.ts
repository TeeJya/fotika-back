import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import driveRoutes from './routes/drive'
import eventsRoutes from './routes/events'
import paymentRoutes from './routes/payment'

dotenv.config()
const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/drive', driveRoutes)
app.use('/api/events', eventsRoutes)
app.use('/api', paymentRoutes)

app.get('/api/health', (req, res) => { res.json({ ok: true }) })
app.get('/health', (req, res) => { res.json({ ok: true }) })

export default app
