import { useCallback, useEffect, useState } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface Note {
  id: string
  title: string
  body: string
  updatedAt: Date
  pinned?: boolean
}

export function useNotes(novelId: string, userId: string) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ref = collection(db, 'users', userId, 'novels', novelId, 'notes')
    getDocs(query(ref, orderBy('updatedAt', 'desc'))).then((snap) => {
      setNotes(snap.docs.map((d) => ({
        id: d.id,
        title: d.data().title as string,
        body: d.data().body as string,
        updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
        pinned: (d.data().pinned as boolean) ?? false,
      })))
      setLoading(false)
    })
  }, [novelId, userId])

  const addNote = useCallback(async (title: string) => {
    const ref = collection(db, 'users', userId, 'novels', novelId, 'notes')
    const docRef = await addDoc(ref, { title, body: '', updatedAt: serverTimestamp() })
    const newNote: Note = { id: docRef.id, title, body: '', updatedAt: new Date() }
    setNotes((prev) => [newNote, ...prev])
    return newNote
  }, [novelId, userId])

  const updateNote = useCallback(async (id: string, changes: Partial<Pick<Note, 'title' | 'body'>>) => {
    await updateDoc(doc(db, 'users', userId, 'novels', novelId, 'notes', id), {
      ...changes,
      updatedAt: serverTimestamp(),
    })
    setNotes((prev) =>
      prev
        .map((n) => n.id === id ? { ...n, ...changes, updatedAt: new Date() } : n)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    )
  }, [novelId, userId])

  const deleteNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'users', userId, 'novels', novelId, 'notes', id))
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [novelId, userId])

  const togglePin = useCallback(async (id: string) => {
    setNotes((prev) => {
      const note = prev.find((n) => n.id === id)
      if (!note) return prev
      const pinned = !note.pinned
      updateDoc(doc(db, 'users', userId, 'novels', novelId, 'notes', id), { pinned }).catch(() => {})
      return prev
        .map((n) => (n.id === id ? { ...n, pinned } : n))
        .sort((a, b) => {
          const pa = a.id === id ? pinned : !!a.pinned
          const pb = b.id === id ? pinned : !!b.pinned
          if (pa && !pb) return -1
          if (!pa && pb) return 1
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        })
    })
  }, [novelId, userId])

  return { notes, loading, addNote, updateNote, deleteNote, togglePin }
}
