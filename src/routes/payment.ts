import { Router } from 'express'
import admin from '../firebaseAdmin'

// Use require to avoid type issues if @types/node-fetch is missing
const fetch = require('node-fetch')

const router = Router()

const SWIFT_API_BASE = process.env.SWIFT_API_BASE || 'https://swiftwallet.co.ke'
const APP_URL = process.env.APP_URL || 'https://social.tausiinitiative.org'

router.post('/initiate-payment', async (req, res) => {
  try {
    const SWIFT_API_KEY = process.env.SWIFT_API_KEY
    if (!SWIFT_API_KEY) {
       console.error('⚠️  SWIFT_API_KEY environment variable is required')
       return res.status(500).json({ success: false, error: 'Server misconfiguration: SWIFT_API_KEY missing' })
    }

    const { amount, phone_number, external_reference, channel_id } = req.body

    if (!amount || !phone_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: amount and phone_number' 
      })
    }

    // Set callback URL to our own backend
    const callback_url = `${APP_URL}/api/callback/payment`
    
    console.log('--- Payment Debug Info ---')
    console.log('APP_URL Env Var:', process.env.APP_URL)
    console.log('Resolved Callback URL:', callback_url)
    console.log('--------------------------')

    const body: any = {
      amount,
      phone_number,
      external_reference,
      callback_url
    }

    if (channel_id) {
      body.channel_id = parseInt(channel_id)
    }

    const response = await fetch(`${SWIFT_API_BASE}/v3/stk-initiate/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SWIFT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()
    console.log(`[Payment] initiated for ${phone_number}. Ref: ${external_reference}. Status: ${response.status}`, data)
    res.json(data)
    
  } catch (error) {
    console.error('Payment proxy error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    })
  }
})

router.post('/callback/payment', async (req, res) => {
  console.log('Received payment callback:', JSON.stringify(req.body, null, 2))
  
  // Extract fields from either top-level or 'result' object (SwiftWallet structure varies)
  const success = req.body.success
  const external_reference = req.body.external_reference
  
  // Try to find values in different places
  const mpesa_receipt_number = req.body.mpesa_receipt_number || req.body.result?.MpesaReceiptNumber
  const amount = req.body.amount || req.body.result?.Amount
  const phone_number = req.body.phone_number || req.body.result?.Phone

  if (success) {
    try {
      // Store successful transaction in Firestore
      await admin.firestore().collection('payments').doc(external_reference).set({
        external_reference,
        mpesa_receipt_number: mpesa_receipt_number || 'UNKNOWN', // Prevent undefined error
        amount: amount || 0,
        phone_number: phone_number || '',
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log(`✅ Payment recorded for ${external_reference}`)
    } catch (err) {
      console.error('❌ Error saving payment to DB:', err)
    }
  } else {
    console.log(`❌ Payment failed/cancelled for ${external_reference}`)
     try {
      await admin.firestore().collection('payments').doc(external_reference).set({
        external_reference,
        status: 'failed',
        reason: req.body.message || 'Unknown',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
    } catch (err) {
      console.error('Error updating failed payment:', err)
    }
  }

  // Always respond 200 to the webhook sender
  res.json({ received: true })
})


// Check payment status
router.get('/status/:reference', async (req, res) => {
  try {
    if (!admin.apps.length) {
      console.error('Firebase Admin not initialized')
      return res.status(500).json({ success: false, error: 'Firebase Admin not initialized. Check server FIREBASE_SERVICE_ACCOUNT env var.' })
    }

    const { reference } = req.params
    const doc = await admin.firestore().collection('payments').doc(reference).get()
    
    if (doc.exists) {
      const data = doc.data()
      return res.json({ 
        success: true, 
        status: data?.status || 'unknown',
        data 
      })
    } else {
      // Not found yet (maybe callback hasn't arrived)
      return res.json({ success: true, status: 'pending' })
    }
  } catch (err: any) {
    console.error('Error checking payment status:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
