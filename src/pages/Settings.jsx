import { useState } from 'react'
import { exportAllData, importAllData } from '../hooks/useStorage'
import './Settings.css'

export default function Settings() {
  const [importStatus, setImportStatus] = useState(null) // 'success' | 'error' | null

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importAllData(file)
      setImportStatus('success')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setImportStatus('error')
    }
    e.target.value = ''
  }

  return (
    <div className="page settings-page">
      <h1 className="settings-title">Settings ⚙️</h1>

      <p className="section-title">Data Backup</p>
      <div className="card settings-card">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Export Backup</div>
            <div className="settings-item-sub">Download all data as a .json file</div>
          </div>
          <button className="settings-btn" onClick={exportAllData}>Export</button>
        </div>

        <div className="settings-divider" />

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Import Backup</div>
            <div className="settings-item-sub">
              {importStatus === 'success' ? '✅ Imported — reloading...' :
               importStatus === 'error'   ? '❌ Invalid or corrupt file' :
               'Restore from a previously exported .json file'}
            </div>
          </div>
          <label className="settings-btn" style={{ cursor: 'pointer' }}>
            Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <p className="section-title">About</p>
      <div className="card settings-card">
        <div className="settings-about">
          <div className="settings-about-name">Motaz Gym Tracker</div>
          <div className="settings-about-sub">4-day Full Body A/B · Recomp protocol</div>
          <div className="settings-about-sub">React + Vite · No backend · Local storage only</div>
        </div>
      </div>
    </div>
  )
}
