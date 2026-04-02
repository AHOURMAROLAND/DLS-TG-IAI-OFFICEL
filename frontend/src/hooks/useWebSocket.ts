import { useEffect, useRef, useCallback } from 'react'

type Handler = (data: any) => void

export function useWebSocket(tournamentId: string | undefined, onMessage: Handler) {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (!tournamentId) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${proto}://${window.location.host}/ws/${tournamentId}`
    const socket = new WebSocket(url)

    socket.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch {}
    }
    socket.onclose = () => {
      // Reconnexion automatique après 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }
    ws.current = socket
  }, [tournamentId, onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  return ws
}
