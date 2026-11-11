import React, { useContext, useEffect, useState, useMemo } from 'react'
import './RestaurantSafety.css'
import { useParams, useNavigate } from 'react-router-dom'
import { StoreContext } from '../../components/context/StoreContext'
import axios from 'axios'

// ── Human-readable labels for backend enum values ──────────────────────────────
const TYPE_LABELS = {
    inspection: 'Inspection',
    violation: 'Violation',
    complaint: 'Complaint',
    certification: 'Certification',
    notice: 'Notice',
    review: 'Review',
    other: 'Other'
}

const STATUS_LABELS = {
    positive: 'Positive',
    negative: 'Negative',
    warning: 'Warning',
    neutral: 'Neutral',
    unknown: 'Unknown'
}

const SEVERITY_LABELS = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
    unknown: 'Unknown'
}

// ── Date helpers ────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

const getSortDate = (item) => {
    return new Date(item.evidenceDate || item.createdAt).getTime()
}

const getDisplayDateInfo = (item) => {
    if (item.evidenceDate) {
        return { date: formatDate(item.evidenceDate), isFallback: false }
    }
    if (item.createdAt) {
        return { date: formatDate(item.createdAt), isFallback: true }
    }
    return { date: null, isFallback: false }
}

const RestaurantSafety = () => {
    const { restaurantId } = useParams()
    const { url, food_list } = useContext(StoreContext)
    const navigate = useNavigate()

    const [evidence, setEvidence]       = useState([])
    const [restaurant, setRestaurant]   = useState(null)
    const [loading, setLoading]         = useState(true)
    const [error, setError]             = useState(false)

    // ── Derive restaurant name from food_list ──────────────────────────────────
    useEffect(() => {
        const food = food_list.find(
            f => f.restaurantId && f.restaurantId._id === restaurantId
        )
        if (food?.restaurantId) {
            setRestaurant(food.restaurantId)
        }
    }, [food_list, restaurantId])

    // ── Fetch safety evidence ──────────────────────────────────────────────────
    const fetchEvidence = async () => {
        setLoading(true)
        setError(false)
        try {
            const res = await axios.get(
                `${url}/api/safety-evidence/list?restaurantId=${restaurantId}`
            )
            if (res.data.success) {
                setEvidence(res.data.data)
            } else {
                setError(true)
            }
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (restaurantId) {
            fetchEvidence()
        }
    }, [restaurantId, url])

    // ── Sort evidence on the client (latest → oldest) ────────────────────────────
    // Never assume the backend returns sorted data
    const sortedEvidence = useMemo(() => {
        return [...evidence].sort((a, b) => getSortDate(b) - getSortDate(a))
    }, [evidence])

    // ── Latest evidence date for summary ────────────────────────────────────────
    const latestDate = sortedEvidence.length > 0
        ? (() => {
            const info = getDisplayDateInfo(sortedEvidence[0])
            return info.date
          })()
        : null

    return (
        <div className='restaurant-safety'>

            {/* ── Back button ─────────────────────────────────────────────────── */}
            <button
                className='rs-back-btn'
                onClick={() => navigate(-1)}
                aria-label='Go back to previous page'
            >
                ← Back
            </button>

            {/* ── Page header ────────────────────────────────────────────────── */}
            <header className='rs-header'>
                <span className='rs-shield' aria-hidden='true'>🛡️</span>
                <div>
                    <h2 className='rs-title'>Restaurant Safety</h2>
                    {restaurant && (
                        <p className='rs-restaurant-name'>{restaurant.name}</p>
                    )}
                    {restaurant?.city && (
                        <p className='rs-restaurant-location'>
                            {restaurant.city}{restaurant.state ? `, ${restaurant.state}` : ''}
                        </p>
                    )}
                </div>
            </header>

            {/* ── Summary strip ──────────────────────────────────────────────── */}
            {!loading && !error && (
                <div className='rs-summary' role='status' aria-live='polite'>
                    <div className='rs-summary-item'>
                        <span className='rs-summary-label'>Evidence Records</span>
                        <span className='rs-summary-value'>{evidence.length}</span>
                    </div>
                    {latestDate && (
                        <div className='rs-summary-item'>
                            <span className='rs-summary-label'>Latest Evidence</span>
                            <span className='rs-summary-value'>{latestDate}</span>
                        </div>
                    )}
                    <div className='rs-summary-item'>
                        <span className='rs-summary-label'>Data Source</span>
                        <span className='rs-summary-value'>HotMeal Safety Database</span>
                    </div>
                </div>
            )}

            {/* ── Disclaimer ────────────────────────────────────────────────── */}
            <p className='rs-disclaimer'>
                The information below reflects submitted safety records. Absence of evidence does not
                imply safety. Always exercise your own judgment.
            </p>

            {/* ── Loading ──────────────────────────────────────────────────── */}
            {loading && (
                <div className='rs-loading' role='status' aria-live='polite'>
                    <p>Loading safety information...</p>
                </div>
            )}

            {/* ── Error ─────────────────────────────────────────────────────── */}
            {!loading && error && (
                <div className='rs-error' role='alert'>
                    <p>Unable to load safety information.</p>
                    <p>Please try again later.</p>
                    <button className='rs-retry-btn' onClick={fetchEvidence}>
                        Try Again
                    </button>
                </div>
            )}

            {/* ── Empty state ───────────────────────────────────────────────── */}
            {!loading && !error && sortedEvidence.length === 0 && (
                <div className='rs-empty'>
                    <p>No safety information available for this restaurant yet.</p>
                    <p className='rs-empty-sub'>
                        This does not confirm the restaurant is safe — it means no
                        evidence has been recorded in our system.
                    </p>
                </div>
            )}

            {/* ── Timeline ──────────────────────────────────────────────────── */}
            {!loading && !error && sortedEvidence.length > 0 && (
                <div className='rs-timeline' role='list'>

                    {sortedEvidence.map((item, index) => {
                        const dateInfo = getDisplayDateInfo(item)
                        const isLast = index === sortedEvidence.length - 1

                        return (
                            <div key={index} className='rs-timeline-item' role='listitem'>

                                {/* Timeline marker + connector line */}
                                <div className='rs-timeline-marker-col'>
                                    <span
                                        className={`rs-timeline-dot rs-dot-${item.type}`}
                                        aria-hidden='true'
                                    />
                                    {!isLast && <span className='rs-timeline-line' aria-hidden='true' />}
                                </div>

                                {/* Evidence content card */}
                                <div className='rs-timeline-content'>

                                    {/* Header: type badge + date */}
                                    <div className='rs-timeline-card-header'>
                                        <span className={`rs-type-badge rs-type-${item.type}`}>
                                            {TYPE_LABELS[item.type] || item.type}
                                        </span>
                                        {dateInfo.date && (
                                            <span className='rs-date'>
                                                {dateInfo.date}
                                                {dateInfo.isFallback && (
                                                    <span
                                                        className='rs-date-fallback'
                                                        title='Evidence date not set — showing record creation date'
                                                    >
                                                        {' '}(record date)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <h3 className='rs-card-title'>{item.title}</h3>

                                    {/* Description */}
                                    <p className='rs-card-description'>{item.description}</p>

                                    {/* Status + Severity badges */}
                                    <div className='rs-badges'>
                                        <span className={`rs-badge rs-status-${item.status}`}>
                                            Status: {STATUS_LABELS[item.status] || item.status}
                                        </span>
                                        <span className={`rs-badge rs-severity-${item.severity}`}>
                                            Severity: {SEVERITY_LABELS[item.severity] || item.severity}
                                        </span>
                                    </div>

                                    {/* Source */}
                                    {(item.sourceName || item.sourceUrl) && (
                                        <div className='rs-source'>
                                            <span className='rs-source-label'>Source: </span>
                                            {item.sourceUrl ? (
                                                <a
                                                    href={item.sourceUrl}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    className='rs-source-link'
                                                    aria-label={`Open source: ${item.sourceName || 'View Source'} in a new tab`}
                                                >
                                                    {item.sourceName || 'View Source'} ↗
                                                </a>
                                            ) : (
                                                <span>{item.sourceName}</span>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </div>
                        )
                    })}

                </div>
            )}

        </div>
    )
}

export default RestaurantSafety
