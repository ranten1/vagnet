import Fastify from 'fastify'
import cors from '@fastify/cors'
import formbody from '@fastify/formbody'
import dotenv from 'dotenv'
import twilio from 'twilio'
import fs from 'fs'
import path from 'path'

dotenv.config()

const fastify = Fastify({ logger: true })

fastify.register(cors, { origin: true })
fastify.register(formbody)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

/* ===========================
   Health
   =========================== */
fastify.get('/ping', async () => ({ pong: true }))

/* ===========================
   ✅ SERVE AUDIO WITH CORRECT MIME
   =========================== */
fastify.get('/audio/:file', async (request, reply) => {
  const filePath = path.join('public', 'audio', request.params.file)

  if (!fs.existsSync(filePath)) {
    return reply.code(404).send('Not found')
  }

  reply
    .header('Content-Type', 'audio/mpeg')
    .header('Cache-Control', 'no-store')
    .send(fs.createReadStream(filePath))
})

/* ===========================
   CALL – initiate call
   =========================== */
fastify.post('/call', async (request, reply) => {
  const { number } = request.body || {}
  if (!number) return reply.code(400).send({ error: 'number required' })

  const filename = 'audio-1765262158067.mp3' // הארדקוד לבדיקת סופית

  const call = await twilioClient.calls.create({
    to: number,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `https://vagnet-production.up.railway.app/voice?file=${filename}`,
    method: 'POST'
  })

  reply.send({ ok: true, sid: call.sid })
})

/* ===========================
   VOICE – Play via /audio
   =========================== */
fastify.post('/voice', async (request, reply) => {
  const file = request.query.file

  reply
    .type('text/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://vagnet-production.up.railway.app/audio/${file}</Play>
  <Pause length="5"/>
</Response>`)
})

/* ===========================
   Start
   =========================== */
fastify.listen({
  port: process.env.PORT || 8080,
  host: '0.0.0.0'
})
