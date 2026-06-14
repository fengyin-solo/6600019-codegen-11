from fastapi import APIRouter, Query
from typing import List, Optional
from app.models.schemas import Alert, AlertAckRequest, NightAlertConfig
from app.services import alert_service

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=List[Alert])
def list_alerts(unacknowledged_only: bool = Query(False)):
    return alert_service.get_alerts(unacknowledged_only=unacknowledged_only)


@router.get("/alerts/pending-count")
def pending_count():
    return {
        "count": alert_service.get_pending_count(),
        "is_night": alert_service.is_night_time(),
    }


@router.post("/alerts/evaluate")
def evaluate_picks(picks: list, station_id: Optional[str] = None, station_name: Optional[str] = None):
    new_alerts = alert_service.evaluate_picks(picks, station_id, station_name)
    return {"new_alerts": len(new_alerts), "alerts": new_alerts}


@router.post("/alerts/acknowledge", response_model=Optional[Alert])
def acknowledge_alert(req: AlertAckRequest):
    return alert_service.acknowledge_alert(req.alert_id, req.operator)


@router.delete("/alerts/cleared")
def clear_acknowledged():
    removed = alert_service.clear_acknowledged()
    return {"removed": removed}


@router.get("/alerts/config", response_model=NightAlertConfig)
def get_config():
    return alert_service.get_config()


@router.put("/alerts/config", response_model=NightAlertConfig)
def update_config(config: NightAlertConfig):
    return alert_service.update_config(config)
