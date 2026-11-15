import React, { useState, useEffect, useCallback } from 'react'
import './IngestionDashboard.css'
import axios from 'axios'
import { toast } from 'react-toastify'

const IngestionDashboard = ({ url }) => {

    const token = localStorage.getItem('token')
    const headers = { token }

    const [health, setHealth]               = useState(null)
    const [status, setStatus]               = useState(null)
    const [runs, setRuns]                   = useState([])
    const [selectedRun, setSelectedRun]     = useState(null)
    const [loadingHealth, setLoadingHealth] = useState(true)
    const [loadingStatus, setLoadingStatus] = useState(true)
    const [loadingRuns, setLoadingRuns]     = useState(true)
    const [loadingRunDetail, setLoadingRunDetail] = useState(false)
    const [ingesting, setIngesting]         = useState(false)
    const [ingestionSource, setIngestionSource] = useState('local-test')

    // ── Fetch health ────────────────────────────────────────────────────────
    const fetchHealth = async () => {
        setLoadingHealth(true)
        try {
            const res = await axios.get(`${url}/api/ingestion/health`, { headers })
            if (res.data.success) setHealth(res.data.data)
        } catch (err) {
            toast.error('Failed to load ingestion health')
        } finally {
            setLoadingHealth(false)
        }
    }

    // ── Fetch status ────────────────────────────────────────────────────────
    const fetchStatus = async () => {
        setLoadingStatus(true)
        try {
            const res = await axios.get(`${url}/api/ingestion/status`, { headers })
            if (res.data.success) setStatus(res.data.data)
        } catch (err) {
            toast.error('Failed to load ingestion status')
        } finally {
            setLoadingStatus(false)
        }
    }

    // ── Fetch runs ───────────────────────────────────────────────────────────
    const fetchRuns = async () => {
        setLoadingRuns(true)
        try {
            const res = await axios.get(`${url}/api/ingestion/runs?limit=20`, { headers })
            if (res.data.success) setRuns(res.data.data)
        } catch (err) {
            toast.error('Failed to load run history')
        } finally {
            setLoadingRuns(false)
        }
    }

    // ── Fetch all data ────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        await Promise.all([fetchHealth(), fetchStatus(), fetchRuns()])
    }, [])

    // ── Load on mount ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAll()
    }, [])

    // ── Run ingestion manually ────────────────────────────────────────────────
    const onRunIngestion = async () => {
        if (ingesting) return
        setIngesting(true)
        try {
            const res = await axios.post(
                `${url}/api/ingestion/run`,
                { source: ingestionSource },
                { headers }
            )
            if (res.data.success) {
                toast.success(res.data.message)
            } else {
                toast.error(res.data.message || 'Ingestion failed')
            }
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error('Ingestion already running for this source')
            } else {
                toast.error(err.response?.data?.message || 'Error triggering ingestion')
            }
        } finally {
            setIngesting(false)
            // Refresh all data after ingestion
            fetchAll()
        }
    }

    // ── View run detail ───────────────────────────────────────────────────────
    const viewRunDetail = async (runId) => {
        setLoadingRunDetail(true)
        setSelectedRun(null)
        try {
            const res = await axios.get(`${url}/api/ingestion/runs/${runId}`, { headers })
            if (res.data.success) {
                setSelectedRun(res.data.data)
            } else {
                toast.error(res.data.message || 'Failed to load run detail')
            }
        } catch (err) {
            toast.error('Failed to load run detail')
        } finally {
            setLoadingRunDetail(false)
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    const formatDuration = (ms) => {
        if (ms === null || ms === undefined) return '—'
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

    const statusClass = (s) => `id-status-badge id-status-${s}`

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className='ingestion-dashboard add flex-col'>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className='id-header'>
                <p>Ingestion Dashboard</p>
                <button
                    className='id-refresh-btn'
                    onClick={fetchAll}
                    disabled={loadingHealth || loadingStatus || loadingRuns}
                >
                    ↻ Refresh
                </button>
            </div>

            {/* ── 1. System Overview ────────────────────────────────────────── */}
            <div className='id-section'>
                <h3 className='id-section-title'>System Overview</h3>
                {loadingHealth ? (
                    <p className='id-loading-text'>Loading health...</p>
                ) : health ? (
                    <div className='id-health-grid'>
                        <div className={`id-health-card ${health.healthy ? 'id-healthy' : 'id-unhealthy'}`}>
                            <span className='id-health-label'>Health</span>
                            <span className='id-health-value'>
                                {health.healthy ? '✅ Healthy' : '⚠️ Issues Detected'}
                            </span>
                        </div>
                        <div className='id-health-card'>
                            <span className='id-health-label'>Scheduler</span>
                            <span className='id-health-value'>
                                {health.schedulerEnabled ? '🟢 Enabled' : '⚪ Disabled'}
                            </span>
                        </div>
                        <div className='id-health-card'>
                            <span className='id-health-label'>Currently Running</span>
                            <span className='id-health-value'>
                                {health.currentlyRunning > 0
                                    ? `🔄 ${health.currentlyRunning} active`
                                    : '⚪ Idle'}
                            </span>
                        </div>
                        <div className='id-health-card'>
                            <span className='id-health-label'>Stale Locks</span>
                            <span className={`id-health-value ${health.staleLocks > 0 ? 'id-warn' : ''}`}>
                                {health.staleLocks > 0 ? `⚠️ ${health.staleLocks}` : '✅ 0'}
                            </span>
                        </div>
                        <div className='id-health-card'>
                            <span className='id-health-label'>Total Runs</span>
                            <span className='id-health-value'>{health.totalRunsRecorded}</span>
                        </div>
                        <div className='id-health-card'>
                            <span className='id-health-label'>Enabled Sources</span>
                            <span className='id-health-value'>{health.enabledSourceCount}</span>
                        </div>
                        {health.misconfiguredSources?.length > 0 && (
                            <div className='id-health-card id-unhealthy'>
                                <span className='id-health-label'>Misconfigured</span>
                                <span className='id-health-value'>
                                    {health.misconfiguredSources.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className='id-loading-text'>Unable to load health data.</p>
                )}

                {/* Scheduler interval from status */}
                {status?.scheduler && (
                    <p className='id-scheduler-info'>
                        Scheduler interval: {status.scheduler.interval} minutes
                        {status.scheduler.running ? ' (currently executing)' : ''}
                    </p>
                )}
            </div>

            {/* ── 2. Run Ingestion ──────────────────────────────────────────── */}
            <div className='id-section'>
                <h3 className='id-section-title'>Run Ingestion</h3>
                <div className='id-run-control'>
                    <select
                        value={ingestionSource}
                        onChange={(e) => setIngestionSource(e.target.value)}
                        disabled={ingesting}
                        className='id-source-select'
                    >
                        <option value='local-test'>Local Test Source</option>
                        <option value='chicago-food-inspections'>Chicago Food Inspections</option>
                        <option value='nyc-dohmh-inspections'>NYC DOHMH Inspections</option>
                    </select>
                    <button
                        className='id-run-btn'
                        onClick={onRunIngestion}
                        disabled={ingesting}
                    >
                        {ingesting ? 'Running...' : 'Run Ingestion'}
                    </button>
                </div>
                <p className='id-run-hint'>
                    Manually triggers ingestion for the selected source. Results appear in Run History below.
                </p>
            </div>

            {/* ── 3. Source Health ──────────────────────────────────────────── */}
            <div className='id-section'>
                <h3 className='id-section-title'>Source Health</h3>
                {loadingStatus ? (
                    <p className='id-loading-text'>Loading source status...</p>
                ) : status?.sources ? (
                    <div className='id-source-list'>
                        {status.sources.map((src, i) => (
                            <div key={i} className='id-source-card'>
                                <div className='id-source-card-header'>
                                    <span className='id-source-name'>{src.sourceName}</span>
                                    <span className={`id-source-lock ${src.locked ? 'id-lock-active' : ''}`}>
                                        {src.locked ? '🔒 Locked' : '🔓 Unlocked'}
                                    </span>
                                </div>
                                <div className='id-source-grid'>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Source ID</span>
                                        <span className='id-field-value'>{src.sourceId}</span>
                                    </div>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Enabled</span>
                                        <span className='id-field-value'>{src.enabled ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Incremental</span>
                                        <span className='id-field-value'>{src.supportsIncremental ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Last Attempt</span>
                                        <span className='id-field-value'>{formatDateTime(src.lastAttemptAt)}</span>
                                    </div>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Last Success</span>
                                        <span className='id-field-value'>{formatDateTime(src.lastSuccessAt)}</span>
                                    </div>
                                    <div className='id-source-field'>
                                        <span className='id-field-label'>Checkpoint</span>
                                        <span className='id-field-value'>{formatDateTime(src.lastCheckpoint)}</span>
                                    </div>
                                    {src.lastError && (
                                        <div className='id-source-field id-source-error'>
                                            <span className='id-field-label'>Last Error</span>
                                            <span className='id-field-value'>{src.lastError}</span>
                                        </div>
                                    )}
                                    {src.lastRun && (
                                        <div className='id-source-field'>
                                            <span className='id-field-label'>Last Run Status</span>
                                            <span className={statusClass(src.lastRun.status)}>
                                                {src.lastRun.status}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className='id-loading-text'>Unable to load source health.</p>
                )}
            </div>

            {/* ── 4. Run History ────────────────────────────────────────────── */}
            <div className='id-section'>
                <h3 className='id-section-title'>Run History</h3>
                {loadingRuns ? (
                    <p className='id-loading-text'>Loading runs...</p>
                ) : runs.length === 0 ? (
                    <p className='id-empty-text'>No ingestion runs recorded yet.</p>
                ) : (
                    <div className='id-runs-table'>
                        <div className='id-runs-format id-runs-title'>
                            <b>Date/Time</b>
                            <b>Source</b>
                            <b>Status</b>
                            <b>Trigger</b>
                            <b>Duration</b>
                            <b>Fetched</b>
                            <b>Inserted</b>
                            <b>Skipped</b>
                            <b>Failed</b>
                            <b>Unresolved</b>
                            <b>Val Fail</b>
                            <b>Action</b>
                        </div>
                        {runs.map((run, i) => (
                            <div key={i} className='id-runs-format'>
                                <p>{formatDateTime(run.startedAt)}</p>
                                <p>{run.sourceType}</p>
                                <p className={statusClass(run.status)}>{run.status}</p>
                                <p>{run.triggerType}</p>
                                <p>{formatDuration(run.durationMs)}</p>
                                <p>{run.fetchedCount}</p>
                                <p>{run.insertedCount}</p>
                                <p>{run.skippedCount}</p>
                                <p>{run.failedCount}</p>
                                <p>{run.unresolvedCount}</p>
                                <p>{run.validationFailedCount}</p>
                                <p>
                                    <button
                                        className='id-detail-btn'
                                        onClick={() => viewRunDetail(run._id)}
                                    >
                                        View
                                    </button>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── 5. Run Detail Modal ───────────────────────────────────────── */}
            {(selectedRun || loadingRunDetail) && (
                <div className='id-detail-overlay' onClick={() => setSelectedRun(null)}>
                    <div className='id-detail-modal' onClick={(e) => e.stopPropagation()}>
                        <div className='id-detail-header'>
                            <h3>Run Details</h3>
                            <button
                                className='id-detail-close'
                                onClick={() => setSelectedRun(null)}
                            >✕</button>
                        </div>
                        {loadingRunDetail ? (
                            <p className='id-loading-text'>Loading run detail...</p>
                        ) : selectedRun ? (
                            <div className='id-detail-content'>
                                <div className='id-detail-grid'>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Run ID</span>
                                        <span className='id-field-value'>{selectedRun._id}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Source</span>
                                        <span className='id-field-value'>{selectedRun.sourceType}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Status</span>
                                        <span className={statusClass(selectedRun.status)}>
                                            {selectedRun.status}
                                        </span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Trigger</span>
                                        <span className='id-field-value'>{selectedRun.triggerType}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Started</span>
                                        <span className='id-field-value'>{formatDateTime(selectedRun.startedAt)}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Completed</span>
                                        <span className='id-field-value'>{formatDateTime(selectedRun.completedAt)}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Duration</span>
                                        <span className='id-field-value'>{formatDuration(selectedRun.durationMs)}</span>
                                    </div>
                                </div>

                                <h4 className='id-detail-subtitle'>Counters</h4>
                                <div className='id-detail-grid'>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Fetched</span>
                                        <span className='id-field-value'>{selectedRun.fetchedCount}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Inserted</span>
                                        <span className='id-field-value'>{selectedRun.insertedCount}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Skipped</span>
                                        <span className='id-field-value'>{selectedRun.skippedCount}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Failed</span>
                                        <span className='id-field-value'>{selectedRun.failedCount}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Unresolved</span>
                                        <span className='id-field-value'>{selectedRun.unresolvedCount}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Validation Failed</span>
                                        <span className='id-field-value'>{selectedRun.validationFailedCount}</span>
                                    </div>
                                </div>

                                <h4 className='id-detail-subtitle'>Checkpoint</h4>
                                <div className='id-detail-grid'>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>Before</span>
                                        <span className='id-field-value'>{formatDateTime(selectedRun.checkpointBefore)}</span>
                                    </div>
                                    <div className='id-detail-field'>
                                        <span className='id-field-label'>After</span>
                                        <span className='id-field-value'>{formatDateTime(selectedRun.checkpointAfter)}</span>
                                    </div>
                                </div>

                                <h4 className='id-detail-subtitle'>Processing Errors</h4>
                                {selectedRun.processingErrors && selectedRun.processingErrors.length > 0 ? (
                                    <div className='id-errors-list'>
                                        {selectedRun.processingErrors.map((err, i) => (
                                            <div key={i} className='id-error-item'>
                                                <span className='id-error-stage'>{err.stage}</span>
                                                <span className='id-error-id'>{err.externalRecordId || '—'}</span>
                                                <span className='id-error-msg'>{err.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className='id-empty-text'>No processing errors.</p>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

        </div>
    )
}

export default IngestionDashboard
