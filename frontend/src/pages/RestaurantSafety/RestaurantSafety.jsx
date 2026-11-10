import React, { useContext, useEffect, useState } from 'react'
import './RestaurantSafety.css'
import { useParams, useNavigate } from 'react-router-dom'
import { StoreContext } from '../../components/context/StoreContext'
import axios from 'axios'

// Human-readable labels for backend enum values
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

const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

const RestaurantSafety = () => {
    const { restaurantId } = useParams()
    const { url, food_list } = useContext(StoreContext)
    const navigate = useNavigate()

    const [evidence, setEvidence]         = useState([])
    const [restaurant, setRestaurant]     = useState(null)
    const [loading, setLoading]           = useState(true)
    const [error, setError]               = useState(false)

    // Derive restaurant name from food_list if available (avoids an extra API call)
    useEffect(() => {
        const food = food_list.find(
            f => f.restaurantId && f.restaurantId._id === restaurantId
        )
        if (food?.restaurantId) {
            setRestaurant(food.restaurantId)
        }
    }, [food_list, restaurantId])

    // Fetch safety evidence for this restaurant
    useEffect(() => {
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

        if (restaurantId) {
            fetchEvidence()
        }
    }, [restaurantId, url])

    // Latest evidence date for summary
    const latestDate = evidence.length > 0
        ? formatDate(evidence[0].evidenceDate || evidence[0].createdAt)
        : null

    return (
        <div className='restaurant-safety'>

            {/* ── Back button ─────────────────────────────────────── */}
            <button className='rs-back-btn' onClick={() => navigate(-1)}>
                ← Back
            </button>

            {/* ── Page header ─────────────────────────────────────── */}
            <div className='rs-header'>
                <span className='rs-shield'>🛡️</span>
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
            </div>

            {/* ── Summary strip ───────────────────────────────────── */}
            {!loading && !error && (
                <div className='rs-summary'>
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

            {/* ── Disclaimer ──────────────────────────────────────── */}
            <p className='rs-disclaimer'>
                The information below reflects submitted safety records. Absence of evidence does not
                imply safety. Always exercise your own judgment.
            </p>

            {/* ── Loading ─────────────────────────────────────────── */}
            {loading && (
                <div className='rs-loading'>
                    <p>Loading safety information...</p>
                </div>
            )}

            {/* ── Error ───────────────────────────────────────────── */}
            {!loading && error && (
                <div className='rs-error'>
                    <p>Unable to load safety information.</p>
                    <p>Please try again later.</p>
                </div>
            )}

            {/* ── Empty state ─────────────────────────────────────── */}
            {!loading && !error && evidence.length === 0 && (
                <div className='rs-empty'>
                    <p>No safety information available for this restaurant yet.</p>
                    <p className='rs-empty-sub'>
                        This does not confirm the restaurant is safe — it means no
                        evidence has been recorded in our system.
                    </p>
                </div>
            )}

            {/* ── Evidence cards ──────────────────────────────────── */}
            {!loading && !error && evidence.length > 0 && (
                <div className='rs-evidence-list'>
                    {evidence.map((item, index) => (
                        <div key={index} className='rs-card'>

                            {/* Card header: type + date */}
                            <div className='rs-card-header'>
                                <span className={`rs-type-badge rs-type-${item.type}`}>
                                    {TYPE_LABELS[item.type] || item.type}
                                </span>
                                {formatDate(item.evidenceDate) && (
                                    <span className='rs-date'>
                                        {formatDate(item.evidenceDate)}
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
                                    {STATUS_LABELS[item.status] || item.status}
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
                                        >
                                            {item.sourceName || 'View Source'}
                                        </a>
                                    ) : (
                                        <span>{item.sourceName}</span>
                                    )}
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            )}

        </div>
    )
}

export default RestaurantSafety
