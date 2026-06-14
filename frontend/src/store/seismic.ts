import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { WaveformData, PhasePick, Station, SeismicEvent, Alert, NightAlertConfig } from '../types'

const STORAGE_KEYS = {
  ALERTS: 'seismic_alerts',
  PICKS: 'seismic_picks',
  ALERT_CONFIG: 'seismic_alert_config',
  SELECTED_STATION: 'seismic_selected_station',
  WAVEFORM: 'seismic_waveform',
} as const

export const useSeismicStore = defineStore('seismic', () => {
  const waveform = ref<WaveformData | null>(null)
  const picks = ref<PhasePick[]>([])
  const selectedStation = ref<Station | null>(null)
  const staWindow = ref(1.0)
  const ltaWindow = ref(10.0)
  const threshold = ref(3.5)
  const isLoading = ref(false)
  const hasLoadedFromStorage = ref(false)
  const events = ref<SeismicEvent[]>([
    { id: '1', magnitude: 4.2, depth: 12.5, originTime: '2025-01-15T08:23:41Z', location: '四川雅安' },
    { id: '2', magnitude: 3.8, depth: 8.3, originTime: '2025-01-14T14:12:05Z', location: '云南大理' },
    { id: '3', magnitude: 5.1, depth: 25.0, originTime: '2025-01-13T02:45:33Z', location: '台湾花莲' },
  ])

  const stations = ref<Station[]>([
    { id: 'STA01', name: 'BJI', latitude: 39.9, longitude: 116.4, elevation: 45 },
    { id: 'STA02', name: 'SSE', latitude: 31.2, longitude: 121.5, elevation: 10 },
    { id: 'STA03', name: 'KMI', latitude: 25.0, longitude: 102.7, elevation: 1890 },
    { id: 'STA04', name: 'HIA', latitude: 49.3, longitude: 119.7, elevation: 610 },
  ])

  const alerts = ref<Alert[]>([])
  const isNight = ref(false)
  const alertConfig = ref<NightAlertConfig>({
    confidence_threshold: 0.8,
    night_start_hour: 22,
    night_end_hour: 6,
    enabled: true,
  })
  const showAlertDialog = ref(false)
  let alertPollTimer: ReturnType<typeof setInterval> | null = null
  let storageSaveTimer: ReturnType<typeof setTimeout> | null = null

  const pendingAlerts = computed(() => alerts.value.filter(a => !a.acknowledged))
  const pendingAlertCount = computed(() => pendingAlerts.value.length)
  const hasCriticalAlert = computed(() => pendingAlerts.value.some(a => a.severity === 'critical'))

  function safeSetItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch (e) {
      console.warn(`Failed to save ${key} to localStorage`, e)
      return false
    }
  }

  function safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      console.warn(`Failed to read ${key} from localStorage`, e)
      return null
    }
  }

  function saveToStorage() {
    if (storageSaveTimer) {
      clearTimeout(storageSaveTimer)
    }
    storageSaveTimer = setTimeout(() => {
      safeSetItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts.value))
      safeSetItem(STORAGE_KEYS.PICKS, JSON.stringify(picks.value))
      safeSetItem(STORAGE_KEYS.ALERT_CONFIG, JSON.stringify(alertConfig.value))
      safeSetItem(STORAGE_KEYS.SELECTED_STATION, JSON.stringify(selectedStation.value))
      if (waveform.value) {
        const saved = safeSetItem(STORAGE_KEYS.WAVEFORM, JSON.stringify(waveform.value))
        if (!saved) {
          localStorage.removeItem(STORAGE_KEYS.WAVEFORM)
        }
      }
    }, 100)
  }

  function loadFromStorage() {
    const savedAlerts = safeGetItem(STORAGE_KEYS.ALERTS)
    if (savedAlerts) {
      try {
        const parsed = JSON.parse(savedAlerts)
        if (Array.isArray(parsed)) {
          alerts.value = parsed.filter(
            (a: any) => a && typeof a.id === 'string' && typeof a.pick_id === 'string'
          )
        }
      } catch (e) {
        console.warn('Failed to parse saved alerts', e)
      }
    }

    const savedPicks = safeGetItem(STORAGE_KEYS.PICKS)
    if (savedPicks) {
      try {
        const parsed = JSON.parse(savedPicks)
        if (Array.isArray(parsed)) {
          picks.value = parsed
        }
      } catch (e) {
        console.warn('Failed to parse saved picks', e)
      }
    }

    const savedConfig = safeGetItem(STORAGE_KEYS.ALERT_CONFIG)
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        alertConfig.value = { ...alertConfig.value, ...parsed }
      } catch (e) {
        console.warn('Failed to parse saved alert config', e)
      }
    }

    const savedStation = safeGetItem(STORAGE_KEYS.SELECTED_STATION)
    if (savedStation) {
      try {
        const parsed = JSON.parse(savedStation)
        if (parsed && parsed.id) {
          const match = stations.value.find(s => s.id === parsed.id)
          selectedStation.value = match || parsed
        }
      } catch (e) {
        console.warn('Failed to parse saved station', e)
      }
    }

    const savedWaveform = safeGetItem(STORAGE_KEYS.WAVEFORM)
    if (savedWaveform) {
      try {
        const parsed = JSON.parse(savedWaveform)
        if (parsed && Array.isArray(parsed.time)) {
          waveform.value = parsed
        }
      } catch (e) {
        console.warn('Failed to parse saved waveform', e)
      }
    }

    hasLoadedFromStorage.value = true

    if (alerts.value.length > 0) {
      const isNightNow = checkLocalNightTime()
      isNight.value = isNightNow
      if (isNightNow && pendingAlertCount.value > 0) {
        showAlertDialog.value = true
      }
    }
  }

  watch(
    () => [alerts.value, picks.value, alertConfig.value, selectedStation.value, waveform.value],
    () => {
      if (hasLoadedFromStorage.value) {
        saveToStorage()
      }
    },
    { deep: true }
  )

  function generateMockWaveform(): WaveformData {
    const sr = 100
    const duration = 60
    const n = sr * duration
    const time = Array.from({ length: n }, (_, i) => i / sr)
    const bhz: number[] = [], bhn: number[] = [], bhe: number[] = []

    for (let i = 0; i < n; i++) {
      const t = time[i]
      let vz = (Math.random() - 0.5) * 0.02
      let ns = (Math.random() - 0.5) * 0.02
      let ew = (Math.random() - 0.5) * 0.02

      if (t > 10 && t < 18) {
        const amp = 0.8 * Math.exp(-(t - 12) * (t - 12) / 8)
        vz += amp * Math.sin(2 * Math.PI * 8 * t)
        ns += amp * 0.3 * Math.sin(2 * Math.PI * 8 * t + 0.5)
        ew += amp * 0.3 * Math.sin(2 * Math.PI * 8 * t + 1.0)
      }

      if (t > 22 && t < 40) {
        const amp = 1.5 * Math.exp(-(t - 28) * (t - 28) / 30)
        vz += amp * 0.4 * Math.sin(2 * Math.PI * 4 * t)
        ns += amp * Math.sin(2 * Math.PI * 4 * t + 0.3)
        ew += amp * Math.sin(2 * Math.PI * 4 * t + 0.8)
      }

      if (t > 35 && t < 55) {
        const amp = 2.0 * Math.exp(-(t - 42) * (t - 42) / 50)
        vz += amp * Math.sin(2 * Math.PI * 1.5 * t)
        ns += amp * Math.sin(2 * Math.PI * 1.5 * t + 0.4)
        ew += amp * Math.sin(2 * Math.PI * 1.5 * t + 0.9)
      }

      bhz.push(vz)
      bhn.push(ns)
      bhe.push(ew)
    }

    return { time, bhz, bhn, bhe, samplingRate: sr }
  }

  function checkLocalNightTime(): boolean {
    const hour = new Date().getHours()
    const start = alertConfig.value.night_start_hour
    const end = alertConfig.value.night_end_hour
    if (start > end) return hour >= start || hour < end
    return start <= hour && hour < end
  }

  function evaluatePicksForAlerts() {
    if (!alertConfig.value.enabled) return
    const isNightNow = checkLocalNightTime()
    isNight.value = isNightNow

    const highConfPicks = picks.value.filter(p => p.confidence >= alertConfig.value.confidence_threshold)
    if (highConfPicks.length === 0) return

    const existingPickIds = new Set(alerts.value.map(a => a.pick_id))
    const newAlerts: Alert[] = []

    for (const pick of highConfPicks) {
      if (existingPickIds.has(pick.id)) continue

      let severity: Alert['severity'] = 'medium'
      if (pick.confidence >= 0.95) severity = 'critical'
      else if (pick.confidence >= 0.9) severity = 'high'

      newAlerts.push({
        id: `alert_${Date.now()}_${pick.id}`,
        pick_id: pick.id,
        pick_type: pick.type,
        confidence: pick.confidence,
        pick_time: pick.time,
        station_id: selectedStation.value?.id ?? null,
        station_name: selectedStation.value?.name ?? null,
        created_at: new Date().toISOString(),
        acknowledged: false,
        acknowledged_at: null,
        acknowledged_by: null,
        severity,
      })
    }

    if (newAlerts.length > 0) {
      alerts.value = [...newAlerts, ...alerts.value]
      if (isNightNow) {
        showAlertDialog.value = true
      }
      sendAlertToBackend(newAlerts)
    }
  }

  async function sendAlertToBackend(newAlerts: Alert[]) {
    try {
      const picksPayload = newAlerts.map(a => ({
        id: a.pick_id,
        type: a.pick_type,
        confidence: a.confidence,
        time: a.pick_time,
      }))
      await fetch('/api/alerts/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(picksPayload),
      })
    } catch { /* fallback: alerts still work locally */ }
  }

  async function acknowledgeAlert(alertId: string, operator: string = '值班员') {
    const alert = alerts.value.find(a => a.id === alertId)
    if (!alert) return

    alert.acknowledged = true
    alert.acknowledged_at = new Date().toISOString()
    alert.acknowledged_by = operator

    try {
      await fetch('/api/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, operator }),
      })
    } catch { /* local state already updated */ }

    if (pendingAlertCount.value === 0) {
      showAlertDialog.value = false
    }
  }

  function acknowledgeAllAlerts() {
    for (const alert of pendingAlerts.value) {
      alert.acknowledged = true
      alert.acknowledged_at = new Date().toISOString()
      alert.acknowledged_by = '值班员'
    }
    showAlertDialog.value = false
  }

  function startAlertPolling(intervalMs: number = 30000) {
    stopAlertPolling()
    alertPollTimer = setInterval(() => {
      evaluatePicksForAlerts()
    }, intervalMs)
  }

  function stopAlertPolling() {
    if (alertPollTimer) {
      clearInterval(alertPollTimer)
      alertPollTimer = null
    }
  }

  function clearAllPersistedData() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ALERTS)
      localStorage.removeItem(STORAGE_KEYS.PICKS)
      localStorage.removeItem(STORAGE_KEYS.WAVEFORM)
      localStorage.removeItem(STORAGE_KEYS.SELECTED_STATION)
    } catch (e) {
      console.warn('Failed to clear persisted data', e)
    }
    alerts.value = []
    picks.value = []
    waveform.value = null
    selectedStation.value = null
  }

  function loadMockData() {
    waveform.value = generateMockWaveform()
    picks.value = [
      { id: 'p1', type: 'P', time: 10.2, confidence: 0.92, method: 'STA/LTA' },
      { id: 'p2', type: 'S', time: 22.5, confidence: 0.88, method: 'STA/LTA' },
    ]
    evaluatePicksForAlerts()
    startAlertPolling()
  }

  function staLtaPicking(): PhasePick[] {
    if (!waveform.value) return []
    const data = waveform.value.bhz
    const sr = waveform.value.samplingRate
    const staLen = Math.floor(staWindow.value * sr)
    const ltaLen = Math.floor(ltaWindow.value * sr)
    const newPicks: PhasePick[] = []

    let lta = 0
    for (let i = ltaLen; i < data.length - staLen; i++) {
      let sta = 0
      for (let j = 0; j < staLen; j++) sta += data[i + j] * data[i + j]
      sta /= staLen

      lta = 0
      for (let j = 0; j < ltaLen; j++) lta += data[i - j] * data[i - j]
      lta /= ltaLen

      const ratio = lta > 0 ? sta / lta : 0
      if (ratio > threshold.value) {
        const t = waveform.value.time[i]
        const existsNear = newPicks.some(p => Math.abs(p.time - t) < 2)
        if (!existsNear) {
          newPicks.push({
            id: `pick_${Date.now()}_${i}`,
            type: newPicks.length === 0 ? 'P' : 'S',
            time: t,
            confidence: Math.min(1, ratio / 10),
            method: 'STA/LTA'
          })
        }
      }
    }
    return newPicks
  }

  async function uploadAndAnalyze(file: File) {
    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/waveform/upload', { method: 'POST', body: formData })
      if (resp.ok) {
        const data = await resp.json()
        waveform.value = data.waveform
        picks.value = data.picks || []
        evaluatePicksForAlerts()
        startAlertPolling()
      }
    } catch {
      loadMockData()
    } finally {
      isLoading.value = false
    }
  }

  return {
    waveform, picks, selectedStation, staWindow, ltaWindow, threshold,
    isLoading, events, stations, hasLoadedFromStorage,
    alerts, isNight, alertConfig, showAlertDialog,
    pendingAlerts, pendingAlertCount, hasCriticalAlert,
    loadMockData, staLtaPicking, uploadAndAnalyze, generateMockWaveform,
    evaluatePicksForAlerts, acknowledgeAlert, acknowledgeAllAlerts,
    startAlertPolling, stopAlertPolling,
    loadFromStorage, saveToStorage, clearAllPersistedData,
  }
})
