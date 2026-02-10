import admin from './firebaseAdmin'

const firestore = admin.firestore()

export type User = { uid: string; email: string; name?: string; driveTokens?: any }
export type Event = { id: string; slug: string; title: string; driveFolderId: string; userId: string; public: boolean }

const usersCol = () => firestore.collection('users')
const eventsCol = () => firestore.collection('events')

export async function getUserByEmail(email: string) {
  const q = await usersCol().where('email', '==', email).limit(1).get()
  const doc = q.docs[0]
  return doc ? ({ uid: doc.id, ...(doc.data() as any) } as User) : null
}

export async function createUser(uid: string, data: Partial<User>) {
  const ref = usersCol().doc(uid)
  await ref.set({ email: data.email || null, name: data.name || null }, { merge: true })
  const snap = await ref.get()
  return { uid: snap.id, ...(snap.data() as any) } as User
}

export async function getUserById(uid: string) {
  const snap = await usersCol().doc(uid).get()
  if (!snap.exists) return null
  return { uid: snap.id, ...(snap.data() as any) } as User
}

export async function saveUserDriveTokens(uid: string, tokens: any) {
  const ref = usersCol().doc(uid)
  await ref.set({ driveTokens: tokens }, { merge: true })
  const snap = await ref.get()
  return { uid: snap.id, ...(snap.data() as any) } as User
}

export async function createEvent(event: Omit<Event, 'id'> & { id?: string }) {
  const doc = eventsCol().doc()
  const id = doc.id
  await doc.set({ ...event, id })
  const snap = await doc.get()
  return { id: snap.id, ...(snap.data() as any) } as Event
}

export async function getEventBySlug(slug: string) {
  const q = await eventsCol().where('slug', '==', slug).limit(1).get()
  const doc = q.docs[0]
  return doc ? ({ id: doc.id, ...(doc.data() as any) } as Event) : null
}

export async function listEventsForUser(uid: string) {
  const q = await eventsCol().where('userId', '==', uid).get()
  return q.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Event))
}

import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'

const file = join(process.cwd(), 'data.json')
const adapter = new JSONFile<{ users: User[]; events: Event[] }>(file)
const db = new Low(adapter, { users: [], events: [] }) // Provide default data here

export async function initDb() {
  await db.read()
  db.data ||= { users: [], events: [] }
  await db.write()
}

export default db
