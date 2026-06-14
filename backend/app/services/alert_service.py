"""Night alert service for high-confidence phase pick detection."""
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.models.schemas import Alert, NightAlertConfig

_alerts: List[Alert] = []
_alert_config = NightAlertConfig()


def get_config() -> NightAlertConfig:
    return _alert_config


def update_config(config: NightAlertConfig) -> NightAlertConfig:
    global _alert_config
    _alert_config = config
    return _alert_config


def is_night_time() -> bool:
    hour = datetime.now().hour
    start = _alert_config.night_start_hour
    end = _alert_config.night_end_hour
    if start > end:
        return hour >= start or hour < end
    return start <= hour < end


def evaluate_picks(
    picks: List[Dict[str, Any]],
    station_id: Optional[str] = None,
    station_name: Optional[str] = None,
) -> List[Alert]:
    new_alerts: List[Alert] = []
    existing_ids = {a.pick_id for a in _alerts}

    for pick in picks:
        confidence = pick.get("confidence", 0)
        if confidence < _alert_config.confidence_threshold:
            continue
        if pick.get("id") in existing_ids:
            continue

        if confidence >= 0.95:
            severity = "critical"
        elif confidence >= 0.9:
            severity = "high"
        else:
            severity = "medium"

        alert = Alert(
            id=f"alert_{datetime.now().strftime('%Y%m%d%H%M%S')}_{pick.get('id', 'unk')}",
            pick_id=pick.get("id", ""),
            pick_type=pick.get("type", "P"),
            confidence=confidence,
            pick_time=pick.get("time", 0),
            station_id=station_id,
            station_name=station_name,
            created_at=datetime.now().isoformat(),
            acknowledged=False,
            severity=severity,
        )
        _alerts.append(alert)
        new_alerts.append(alert)

    return new_alerts


def get_alerts(unacknowledged_only: bool = False) -> List[Alert]:
    if unacknowledged_only:
        return [a for a in _alerts if not a.acknowledged]
    return list(_alerts)


def acknowledge_alert(alert_id: str, operator: str = "值班员") -> Optional[Alert]:
    for alert in _alerts:
        if alert.id == alert_id and not alert.acknowledged:
            alert.acknowledged = True
            alert.acknowledged_at = datetime.now().isoformat()
            alert.acknowledged_by = operator
            return alert
    return None


def get_pending_count() -> int:
    return sum(1 for a in _alerts if not a.acknowledged)


def clear_acknowledged() -> int:
    global _alerts
    before = len(_alerts)
    _alerts = [a for a in _alerts if not a.acknowledged]
    return before - len(_alerts)
