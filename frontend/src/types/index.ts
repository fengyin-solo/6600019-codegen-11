export interface WaveformData {
  time: number[]
  bhz: number[]
  bhn: number[]
  bhe: number[]
  samplingRate: number
}

export interface PhasePick {
  id: string
  type: 'P' | 'S'
  time: number
  confidence: number
  method: string
}

export interface Station {
  id: string
  name: string
  latitude: number
  longitude: number
  elevation: number
}

export interface SeismicEvent {
  id: string
  magnitude: number
  depth: number
  originTime: string
  location: string
}

export interface Alert {
  id: string
  pick_id: string
  pick_type: string
  confidence: number
  pick_time: number
  station_id: string | null
  station_name: string | null
  created_at: string
  acknowledged: boolean
  acknowledged_at: string | null
  acknowledged_by: string | null
  severity: 'medium' | 'high' | 'critical'
}

export interface NightAlertConfig {
  confidence_threshold: number
  night_start_hour: number
  night_end_hour: number
  enabled: boolean
}
