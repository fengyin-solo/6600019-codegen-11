from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class PhasePick(BaseModel):
    id: str
    type: str
    confidence: float
    method: str
    time: float


class Station(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    elevation: float


class SeismicEvent(BaseModel):
    id: str
    magnitude: float
    depth: float
    origin_time: str
    location: str


class Alert(BaseModel):
    id: str
    pick_id: str
    pick_type: str
    confidence: float
    pick_time: float
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    created_at: str
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    acknowledged_by: Optional[str] = None
    severity: str = "high"


class AlertAckRequest(BaseModel):
    alert_id: str
    operator: str = "值班员"


class NightAlertConfig(BaseModel):
    confidence_threshold: float = 0.8
    night_start_hour: int = 22
    night_end_hour: int = 6
    enabled: bool = True
