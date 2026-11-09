import React, { useContext, useState } from 'react'
import './AdminLoginPopup.css'
import { assets } from '../../assets/assets'
import { StoreContext } from '../context/StoreContext'
import axios from 'axios'

// The port the admin Vite app runs on — change here if it differs
const ADMIN_PANEL_URL = 'http://localhost:5174'

const AdminLoginPopup = ({ setShowAdminLogin }) => {

    const { url } = useContext(StoreContext)

    const [data, setData] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const onChangeHandler = (event) => {
        const { name, value } = event.target
        setData(prev => ({ ...prev, [name]: value }))
        setError('')
    }

    const onSubmitHandler = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await axios.post(`${url}/api/user/login`, data)

            if (!response.data.success) {
                setError(response.data.message || 'Login failed.')
                setLoading(false)
                return
            }

            // Role check — only admin accounts may proceed
            if (response.data.role !== 'admin') {
                setError('Admin access required. This account does not have admin privileges.')
                setLoading(false)
                return
            }

            // Store under the keys the existing Admin Panel reads on mount
            // These are the same keys admin/src/App.jsx checks:
            //   localStorage.getItem('token')
            //   localStorage.getItem('role')
            localStorage.setItem('token', response.data.token)
            localStorage.setItem('role', response.data.role)

            // Open the existing Admin Panel in a new tab
            window.open(ADMIN_PANEL_URL, '_blank')

            // Close the modal
            setShowAdminLogin(false)

        } catch (err) {
            setError('Error connecting to server. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='admin-login-popup'>
            <form onSubmit={onSubmitHandler} className='admin-login-popup-container'>

                <div className='admin-login-popup-title'>
                    <h2>Admin Login</h2>
                    <img
                        onClick={() => setShowAdminLogin(false)}
                        src={assets.cross_icon}
                        alt='close'
                    />
                </div>

                <p className='admin-login-popup-subtitle'>
                    Admin accounts only. This opens the Admin Panel.
                </p>

                <div className='admin-login-popup-inputs'>
                    <input
                        name='email'
                        onChange={onChangeHandler}
                        value={data.email}
                        type='email'
                        placeholder='Admin email'
                        required
                    />
                    <input
                        name='password'
                        onChange={onChangeHandler}
                        value={data.password}
                        type='password'
                        placeholder='Password'
                        required
                    />
                </div>

                {error && <p className='admin-login-popup-error'>{error}</p>}

                <button type='submit' disabled={loading}>
                    {loading ? 'Signing in...' : 'Open Admin Panel'}
                </button>

            </form>
        </div>
    )
}

export default AdminLoginPopup
