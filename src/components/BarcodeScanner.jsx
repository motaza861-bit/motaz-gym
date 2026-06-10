import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import './BarcodeScanner.css'

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

function hasNativeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function'
}

export default function BarcodeScanner({ onDetect, onClose }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const zxingControlsRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        if (hasNativeDetector()) {
          detectorRef.current = new window.BarcodeDetector({ formats: BARCODE_FORMATS })
          loopNative()
        } else {
          startZxing()
        }
      } catch (e) {
        setError(t('bs.err_camera'))
      }
    }

    function loopNative() {
      if (cancelled) return
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loopNative)
        return
      }
      detectorRef.current.detect(video).then(codes => {
        if (cancelled) return
        if (codes && codes.length > 0) {
          handleDetected(codes[0].rawValue)
          return
        }
        rafRef.current = requestAnimationFrame(loopNative)
      }).catch(() => {
        rafRef.current = requestAnimationFrame(loopNative)
      })
    }

    async function startZxing() {
      try {
        const mod = await import('@zxing/browser')
        const reader = new mod.BrowserMultiFormatReader()
        zxingControlsRef.current = await reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (cancelled) return
          if (result) handleDetected(result.getText())
        })
      } catch (e) {
        setError(t('bs.err_load'))
      }
    }

    function handleDetected(value) {
      if (cancelled) return
      cancelled = true
      try { navigator.vibrate?.(50) } catch {}
      stop()
      onDetect(value)
    }

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (zxingControlsRef.current) {
        try { zxingControlsRef.current.stop() } catch {}
        zxingControlsRef.current = null
      }
      const stream = streamRef.current
      if (stream) stream.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    start()
    return () => { cancelled = true; stop() }
  }, [onDetect])

  return (
    <div className="barcode-scanner">
      <div className="bs-header">
        <button className="bs-close" aria-label={t('bs.close_aria')} onClick={onClose}>✕</button>
        <span style={{ color: 'white', fontSize: 14 }}>{t('bs.title')}</span>
        <span style={{ width: 38 }} />
      </div>
      <div className="bs-video-wrap">
        <video ref={videoRef} className="bs-video" playsInline muted />
        <div className="bs-crosshair">
          <div className="bs-crosshair-box" />
        </div>
        <div className="bs-hint">{t('bs.hint')}</div>
        {error && <div className="bs-error">{error}</div>}
      </div>
    </div>
  )
}
