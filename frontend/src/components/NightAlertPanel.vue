<template>
  <div v-if="store.pendingAlertCount > 0" class="night-alert-overlay" :class="{ 'critical-mode': store.hasCriticalAlert }">
    <div class="alert-banner" :class="{ 'pulse-critical': store.hasCriticalAlert, 'pulse-high': !store.hasCriticalAlert }">
      <div class="alert-banner-content">
        <div class="alert-icon-wrap">
          <span class="alert-icon">{{ store.hasCriticalAlert ? '🔴' : '🟠' }}</span>
          <span v-if="store.isNight" class="night-badge">夜间值班</span>
        </div>
        <div class="alert-text">
          <h2>高置信度拾取告警</h2>
          <p>检测到 <strong>{{ store.pendingAlertCount }}</strong> 条待处理高置信度震相拾取结果，请及时确认</p>
        </div>
        <div class="alert-actions">
          <button @click="store.showAlertDialog = true" class="btn-view">
            查看详情 ({{ store.pendingAlertCount }})
          </button>
          <button @click="store.acknowledgeAllAlerts()" class="btn-ack-all">
            全部确认
          </button>
        </div>
      </div>
    </div>

    <Transition name="slide-down">
      <div v-if="store.showAlertDialog" class="alert-dialog-backdrop" @click.self="store.showAlertDialog = false">
        <div class="alert-dialog">
          <div class="alert-dialog-header">
            <h3>🚨 夜间告警 — 待处理拾取结果</h3>
            <button @click="store.showAlertDialog = false" class="btn-close">&times;</button>
          </div>

          <div class="alert-config-bar">
            <label class="config-item">
              <input type="checkbox" v-model="store.alertConfig.enabled" />
              <span>启用夜间告警</span>
            </label>
            <label class="config-item">
              置信度阈值:
              <input type="range" v-model.number="store.alertConfig.confidence_threshold" min="0.5" max="1" step="0.05" class="config-slider" />
              <span class="config-value">{{ (store.alertConfig.confidence_threshold * 100).toFixed(0) }}%</span>
            </label>
            <label class="config-item">
              夜间时段: {{ store.alertConfig.night_start_hour }}:00 — {{ store.alertConfig.night_end_hour }}:00
            </label>
          </div>

          <div class="alert-list">
            <div
              v-for="alert in store.pendingAlerts"
              :key="alert.id"
              class="alert-item"
              :class="`severity-${alert.severity}`"
            >
              <div class="alert-item-left">
                <span class="severity-badge" :class="`badge-${alert.severity}`">
                  {{ alert.severity === 'critical' ? '紧急' : alert.severity === 'high' ? '高' : '中' }}
                </span>
                <span class="pick-type" :class="alert.pick_type === 'P' ? 'type-p' : 'type-s'">
                  {{ alert.pick_type }} 波
                </span>
                <span class="pick-conf">{{ (alert.confidence * 100).toFixed(0) }}%</span>
              </div>
              <div class="alert-item-center">
                <span class="pick-time">到达时间: {{ alert.pick_time.toFixed(2) }}s</span>
                <span v-if="alert.station_name" class="pick-station">台站: {{ alert.station_name }}</span>
                <span class="pick-created">{{ formatTime(alert.created_at) }}</span>
              </div>
              <div class="alert-item-right">
                <button @click="store.acknowledgeAlert(alert.id)" class="btn-ack">
                  确认处理
                </button>
              </div>
            </div>
          </div>

          <div class="alert-dialog-footer">
            <span class="footer-info">
              已确认: {{ store.alerts.filter(a => a.acknowledged).length }} | 待处理: {{ store.pendingAlertCount }}
            </span>
            <button @click="store.acknowledgeAllAlerts()" class="btn-ack-all-lg">
              全部确认处理
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useSeismicStore } from '../store/seismic'

const store = useSeismicStore()

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return isoStr
  }
}
</script>

<style scoped>
.night-alert-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
}

.night-alert-overlay > * {
  pointer-events: auto;
}

.alert-banner {
  background: linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%);
  border-bottom: 2px solid #f97316;
  box-shadow: 0 4px 24px rgba(249, 115, 22, 0.4);
}

.critical-mode .alert-banner {
  background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #dc2626 100%);
  border-bottom-color: #ef4444;
  box-shadow: 0 4px 24px rgba(239, 68, 68, 0.5);
}

.pulse-high {
  animation: pulse-high 2s ease-in-out infinite;
}

.pulse-critical {
  animation: pulse-critical 1s ease-in-out infinite;
}

@keyframes pulse-high {
  0%, 100% { box-shadow: 0 4px 24px rgba(249, 115, 22, 0.4); }
  50% { box-shadow: 0 4px 40px rgba(249, 115, 22, 0.8); }
}

@keyframes pulse-critical {
  0%, 100% { box-shadow: 0 4px 24px rgba(239, 68, 68, 0.5); }
  50% { box-shadow: 0 4px 48px rgba(239, 68, 68, 1), 0 0 80px rgba(239, 68, 68, 0.3); }
}

.alert-banner-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.alert-icon-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.alert-icon {
  font-size: 24px;
}

.night-badge {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  color: #fde68a;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(253, 230, 138, 0.3);
}

.alert-text h2 {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.alert-text p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  margin: 2px 0 0;
}

.alert-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.btn-view {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-view:hover {
  background: rgba(255, 255, 255, 0.25);
}

.btn-ack-all {
  background: #f59e0b;
  color: #000;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ack-all:hover {
  background: #fbbf24;
}

.alert-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.alert-dialog {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 16px;
  width: 90%;
  max-width: 720px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
}

.alert-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #1f2937;
}

.alert-dialog-header h3 {
  font-size: 18px;
  color: #fbbf24;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #fff;
}

.alert-config-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #0f172a;
  border-bottom: 1px solid #1f2937;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
}

.config-slider {
  width: 80px;
  height: 4px;
  appearance: none;
  background: #334155;
  border-radius: 2px;
  outline: none;
}

.config-value {
  color: #fbbf24;
  font-weight: 600;
}

.alert-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  border-left: 4px solid;
  background: #1e293b;
  transition: background 0.2s;
}

.alert-item:hover {
  background: #273449;
}

.alert-item.severity-critical {
  border-left-color: #ef4444;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.1), #1e293b 30%);
}

.alert-item.severity-high {
  border-left-color: #f97316;
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.08), #1e293b 30%);
}

.alert-item.severity-medium {
  border-left-color: #eab308;
  background: linear-gradient(90deg, rgba(234, 179, 8, 0.06), #1e293b 30%);
}

.alert-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
}

.severity-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.badge-critical {
  background: #ef4444;
  color: #fff;
}

.badge-high {
  background: #f97316;
  color: #fff;
}

.badge-medium {
  background: #eab308;
  color: #000;
}

.pick-type {
  font-weight: 700;
  font-size: 14px;
}

.type-p {
  color: #f87171;
}

.type-s {
  color: #60a5fa;
}

.pick-conf {
  color: #fbbf24;
  font-weight: 600;
  font-size: 13px;
}

.alert-item-center {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.pick-time {
  color: #e2e8f0;
  font-size: 13px;
}

.pick-station {
  color: #94a3b8;
  font-size: 12px;
}

.pick-created {
  color: #64748b;
  font-size: 11px;
}

.alert-item-right {
  margin-left: auto;
}

.btn-ack {
  background: #059669;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ack:hover {
  background: #10b981;
}

.alert-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #1f2937;
}

.footer-info {
  font-size: 12px;
  color: #64748b;
}

.btn-ack-all-lg {
  background: #d97706;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ack-all-lg:hover {
  background: #f59e0b;
}

.slide-down-enter-active {
  animation: slideDown 0.3s ease-out;
}

.slide-down-leave-active {
  animation: slideDown 0.2s ease-in reverse;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
