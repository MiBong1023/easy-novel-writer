import { useState } from 'react'

export function useAutoConvert() {
  const [on, setOn] = useState(() => localStorage.getItem('autoConvert') !== 'false')

  function toggle() {
    setOn((prev) => {
      const next = !prev
      localStorage.setItem('autoConvert', String(next))
      return next
    })
  }

  return { autoConvert: on, toggleAutoConvert: toggle }
}
