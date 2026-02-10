const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// SwiftWallet config from environment
const SWIFT_API_BASE = process.env.SWIFT_API_BASE || 'https://swiftwallet.co.ke'
const SWIFT_API_KEY = process.env.SWIFT_API_KEY

if (!SWIFT_API_KEY) {
  console.error('⚠️  SWIFT_API_KEY environment variable is required')
  process.exit(1)
}

// Payment proxy endpoint
app.post('/api/initiate-payment', async (req, res) => {
  try {
    const { amount, phone_number, external_reference, channel_id } = req.body

    // Validate required fields
    if (!amount || !phone_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: amount and phone_number' 
      })
    }

    // Prepare SwiftWallet request
    const body = {
      amount,
      phone_number,
      external_reference
    }

    if (channel_id) {
      body.channel_id = parseInt(channel_id)
    }

    // Call SwiftWallet API
    const response = await fetch(`${SWIFT_API_BASE}/v3/stk-initiate/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SWIFT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    
    // Return the response from SwiftWallet
    res.json(data)
    
  } catch (error) {
    console.error('Payment proxy error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Payment proxy server running on http://localhost:${PORT}`)
  console.log(`📡 SwiftWallet API Base: ${SWIFT_API_BASE}`)
  console.log(`🔑 API Key configured: ${SWIFT_API_KEY ? '✅' : '❌'}`)
})