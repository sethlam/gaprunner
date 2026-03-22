'use client'

import { useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'

const FacePreviewCanvas = dynamic(() => import('./FacePreviewCanvas'), { ssr: false })

export default function FacePreviewPage() {
  return (
    <div style={{
      background: '#0D1B2A', minHeight: '100vh', padding: 20,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <h1 style={{ color: 'white', fontFamily: 'sans-serif', fontSize: 22, margin: 0 }}>
        Pick a Face Style
      </h1>
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', width: '100%',
      }}>
        {['A: Kawaii Bead', 'B: Big Anime', 'C: Squishy Dot'].map((label, i) => (
          <div key={i} style={{
            width: 300, height: 380, borderRadius: 16,
            background: '#152238', border: '2px solid #2A3A5C',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ flex: 1 }}>
              <FacePreviewCanvas faceStyle={i} />
            </div>
            <div style={{
              textAlign: 'center', padding: '10px 0', color: 'white',
              fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: 16,
              borderTop: '1px solid #2A3A5C',
            }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
