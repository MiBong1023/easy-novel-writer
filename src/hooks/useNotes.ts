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
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...changes, updatedAt: new Date() } : n))
  }, [novelId, userId])

  const deleteNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'users', userId, 'novels', novelId, 'notes', id))
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [novelId, userId])

  return { notes, loading, addNote, updateNote, deleteNote }
}
