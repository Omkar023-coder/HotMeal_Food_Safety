import React, { useState, useEffect } from 'react'
import './SafetyEvidence.css'
import axios from 'axios'
import { toast } from 'react-toastify'

const EVIDENCE_TYPES = ['inspection', 'violation', 'complaint', 'certification', 'notice', 'review', 'other']
const STATUS_OPTIONS = ['unknown', 'positive', 'negative', 'warning', 'neutral']
const SEVERITY_OPTIONS = ['unknown', 'low', 'medium', 'high', 'critical']

const emptyForm = {
    restaurantId: '',
    type: 'inspection',
    title: '',
    description: '',
    sourceName: '',
    sourceUrl: '',
    evidenceDate: '',
    status: 'unknown',
    severity: 'unknown'
}

const SafetyEvidence = ({ url }) => {

    const [form, setForm]               = useState(emptyForm)
    const [restaurants, setRestaurants] = useState([])
    const [evidenceList, setEvidenceList] = useState([])
    const [filterRestaurant, setFilterRestaurant] = useState('')
    const [loading, setLoading]         = useState(false)
    const [showForm, setShowForm]       = useState(false)

    // ── Load restaurants for dropdown ───────────────────────────────────────────
    const fetchRestaurants = async () => {
        try {
            const res = await axios.get(`${url}/api/restaurant/list`)
            if (res.data.success) {
                setRestaurants(res.data.data)
            } else {
                toast.error('Failed to load restaurants')
            }
        } catch {
            toast.error('Error connecting to server')
        }
    }

    // ── Load evidence list (with optional restaurant filter) ─────────────────────
    const fetchEvidence = async (restaurantId = '') => {
        setLoading(true)
        try {
            const query = restaurantId ? `?restaurantId=${restaurantId}` : ''
            const res = await axios.get(`${url}/api/safety-evidence/list${query}`)
            if (res.data.success) {
                setEvidenceList(res.data.data)
            } else {
                toast.error('Error fetching evidence')
            }
        } catch {
            toast.error('Error connecting to server')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRestaurants()
        fetchEvidence()
    }, [])

    // ── Filter change ────────────────────────────────────────────────────────────
    const onFilterChange = (e) => {
        const val = e.target.value
        setFilterRestaurant(val)
        fetchEvidence(val)
    }

    // ── Form change handler ──────────────────────────────────────────────────────
    const onChangeHandler = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    // ── Submit new evidence ──────────────────────────────────────────────────────
    const onSubmitHandler = async (e) => {
        e.preventDefault()

        if (!form.restaurantId) {
            toast.error('Please select a restaurant.')
            return
        }

        try {
            const token = localStorage.getItem('token')
            const payload = {
                ...form,
                evidenceDate: form.evidenceDate || null
            }

            const res = await axios.post(
                `${url}/api/safety-evidence/add`,
                payload,
                { headers: { token } }
            )

            if (res.data.success) {
                toast.success(res.data.message)
                setForm(emptyForm)
                setShowForm(false)
                fetchEvidence(filterRestaurant)
            } else {
                toast.error(res.data.message)
            }
        } catch {
            toast.error('Error connecting to server')
        }
    }

    // ── Delete evidence ──────────────────────────────────────────────────────────
    const removeEvidence = async (id) => {
        try {
            const token = localStorage.getItem('token')
            const res = await axios.post(
                `${url}/api/safety-evidence/remove`,
                { id },
                { headers: { token } }
            )
            if (res.data.success) {
                toast.success(res.data.message)
                fetchEvidence(filterRestaurant)
            } else {
                toast.error(res.data.message)
            }
        } catch {
            toast.error('Error connecting to server')
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        })
    }

    return (
        <div className='safety-evidence add flex-col'>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className='se-header'>
                <p>Safety Evidence</p>
                <button
                    className='se-toggle-btn'
                    onClick={() => setShowForm(prev => !prev)}
                >
                    {showForm ? '✕ Cancel' : '+ Add Evidence'}
                </button>
            </div>

            {/* ── Add Form ───────────────────────────────────────────────────── */}
            {showForm && (
                <form className='se-form flex-col' onSubmit={onSubmitHandler}>

                    <div className='se-form-row'>
                        <div className='se-field flex-col'>
                            <p>Restaurant <span className='se-required'>*</span></p>
                            <select name='restaurantId' value={form.restaurantId} onChange={onChangeHandler}>
                                <option value=''>-- Select Restaurant --</option>
                                {restaurants.map(r => (
                                    <option key={r._id} value={r._id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className='se-field flex-col'>
                            <p>Evidence Type <span className='se-required'>*</span></p>
                            <select name='type' value={form.type} onChange={onChangeHandler}>
                                {EVIDENCE_TYPES.map(t => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className='se-field flex-col'>
                        <p>Title <span className='se-required'>*</span></p>
                        <input
                            type='text'
                            name='title'
                            value={form.title}
                            onChange={onChangeHandler}
                            placeholder='e.g. Annual Health Inspection 2024'
                            required
                        />
                    </div>

                    <div className='se-field flex-col'>
                        <p>Description <span className='se-required'>*</span></p>
                        <textarea
                            name='description'
                            value={form.description}
                            onChange={onChangeHandler}
                            rows={4}
                            placeholder='Describe the safety evidence...'
                            required
                        />
                    </div>

                    <div className='se-form-row'>
                        <div className='se-field flex-col'>
                            <p>Source Name</p>
                            <input
                                type='text'
                                name='sourceName'
                                value={form.sourceName}
                                onChange={onChangeHandler}
                                placeholder='e.g. FSSAI'
                            />
                        </div>
                        <div className='se-field flex-col'>
                            <p>Source URL</p>
                            <input
                                type='url'
                                name='sourceUrl'
                                value={form.sourceUrl}
                                onChange={onChangeHandler}
                                placeholder='https://...'
                            />
                        </div>
                        <div className='se-field flex-col'>
                            <p>Evidence Date</p>
                            <input
                                type='date'
                                name='evidenceDate'
                                value={form.evidenceDate}
                                onChange={onChangeHandler}
                            />
                        </div>
                    </div>

                    <div className='se-form-row'>
                        <div className='se-field flex-col'>
                            <p>Status</p>
                            <select name='status' value={form.status} onChange={onChangeHandler}>
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                        <div className='se-field flex-col'>
                            <p>Severity</p>
                            <select name='severity' value={form.severity} onChange={onChangeHandler}>
                                {SEVERITY_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button type='submit' className='add-btn'>Save Evidence</button>

                </form>
            )}

            {/* ── Filter ─────────────────────────────────────────────────────── */}
            <div className='se-filter flex-col'>
                <p>Filter by Restaurant</p>
                <select value={filterRestaurant} onChange={onFilterChange}>
                    <option value=''>All Restaurants</option>
                    {restaurants.map(r => (
                        <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                </select>
            </div>

            {/* ── Evidence List ──────────────────────────────────────────────── */}
            <div className='se-list-table'>

                <div className='se-list-format se-list-title'>
                    <b>Restaurant</b>
                    <b>Type</b>
                    <b>Title</b>
                    <b>Source</b>
                    <b>Date</b>
                    <b>Status</b>
                    <b>Severity</b>
                    <b>Action</b>
                </div>

                {loading ? (
                    <p className='se-list-message'>Loading...</p>
                ) : evidenceList.length === 0 ? (
                    <p className='se-list-message'>No evidence records found.</p>
                ) : (
                    evidenceList.map((item, index) => (
                        <div key={index} className='se-list-format'>
                            <p>{item.restaurantId?.name || '—'}</p>
                            <p className={`se-type-badge se-type-${item.type}`}>
                                {item.type}
                            </p>
                            <p className='se-title-cell' title={item.description}>{item.title}</p>
                            <p>
                                {item.sourceUrl
                                    ? <a href={item.sourceUrl} target='_blank' rel='noreferrer' className='se-source-link'>
                                        {item.sourceName || 'Link'}
                                    </a>
                                    : item.sourceName || '—'
                                }
                            </p>
                            <p>{formatDate(item.evidenceDate)}</p>
                            <p className={`status-badge se-status-${item.status}`}>
                                {item.status}
                            </p>
                            <p className={`status-badge se-severity-${item.severity}`}>
                                {item.severity}
                            </p>
                            <p
                                onClick={() => removeEvidence(item._id)}
                                className='cursor'
                            >X</p>
                        </div>
                    ))
                )}

            </div>

        </div>
    )
}

export default SafetyEvidence
