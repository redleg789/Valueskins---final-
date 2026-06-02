import { useState } from 'react'
import { User } from '@/types'
import { getPrivacyDashboardData, downloadDataExport, deleteAccountPermanently } from '@/lib/guards/privacyControls'

interface PrivacyDashboardProps {
  user: User
  onClose: () => void
}

export default function PrivacyDashboard({ user, onClose }: PrivacyDashboardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleExportData = async () => {
    try {
      await downloadDataExport(user.id)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data')
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete account permanently? This cannot be undone.')) return

    setDeleting(true)
    try {
      await deleteAccountPermanently(user.id)
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Deletion failed:', error)
      alert('Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded w-full max-w-2xl max-h-96 overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Privacy & Data</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            X
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-white mb-2">What We Collect</h3>
            <div className="bg-gray-800 p-3 rounded text-sm text-gray-300 space-y-1">
              <div>Profile: name, email, username, bio</div>
              <div>Activity: posts, comments, messages</div>
              <div>Interactions: follows, likes</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">What We DON'T Collect</h3>
            <div className="bg-gray-800 p-3 rounded text-sm text-gray-300">
              Location • Device identifiers • Browsing history • Behavioral profiling
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Tracking</h3>
            <div className="bg-gray-800 p-3 rounded text-sm text-green-400">
              ✓ No third-party tracking
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Data Sharing</h3>
            <div className="bg-gray-800 p-3 rounded text-sm text-green-400">
              ✓ We never sell or share your data
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-2">Security</h3>
            <div className="bg-gray-800 p-3 rounded text-sm text-gray-300 space-y-1">
              <div>Messages: Encrypted in transit (TLS 1.3+)</div>
              <div>Storage: AES-256-GCM encryption at rest</div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleExportData}
              className="w-full bg-white hover:bg-gray-100 text-black font-semibold py-2 rounded text-sm transition"
            >
              Download My Data (JSON)
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold py-2 rounded text-sm transition"
            >
              {deleting ? 'Deleting...' : 'Delete Account Permanently'}
            </button>
          </div>

          <div className="bg-gray-800 p-3 rounded text-xs text-gray-400">
            Your privacy is a right, not a feature. ValueSkins doesn't profit from your data.
          </div>
        </div>
      </div>
    </div>
  )
}
