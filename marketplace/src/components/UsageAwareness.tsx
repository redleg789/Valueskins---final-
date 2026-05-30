import { useEffect, useState } from 'react'

export default function UsageAwareness() {
  const [sessionStartTime] = useState(Date.now())
  const [showAlert, setShowAlert] = useState(false)
  const [sessionMinutes, setSessionMinutes] = useState(0)

  useEffect(() => {
    const checkSessionTime = setInterval(() => {
      const elapsed = Math.round((Date.now() - sessionStartTime) / 1000 / 60)
      setSessionMinutes(elapsed)

      if (elapsed === 120) {
        setShowAlert(true)
      }
    }, 60000)

    return () => clearInterval(checkSessionTime)
  }, [sessionStartTime])

  if (!showAlert) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-sm bg-gray-800 border border-gray-700 rounded p-4 z-40">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold text-white mb-1">
            You've been here {sessionMinutes} minutes
          </div>
          <div className="text-sm text-gray-400">
            Taking breaks is good. No pressure to stay on the app.
          </div>
        </div>
        <button
          onClick={() => setShowAlert(false)}
          className="text-gray-400 hover:text-white font-bold"
        >
          X
        </button>
      </div>
    </div>
  )
}
