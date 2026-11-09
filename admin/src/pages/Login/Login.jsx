import React, { useState } from 'react'
import './Login.css'
import axios from 'axios'
import { assets } from '../../assets/assets'

const Login = ({ url, onLogin }) => {

    const [data, setData] = useState({
        email: '',
        password: ''
    })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const onChangeHandler = (event) => {
        const name = event.target.name
        const value = event.target.value
        setData(data => ({ ...data, [name]: value }))
        setError('')
    }

    const onSubmitHandler = async (event) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        try {
            const response = await axios.post(`${url}/api/user/login`, data)

            if (response.data.success) {

                // Role check — must be admin to enter the admin panel
                if (response.data.role !== 'admin') {
                    setError('Admin access required. This panel is restricted to administrators.')
                    setLoading(false)
                    return
                }

                // Store token and role — never store password
                localStorage.setItem('token', response.data.token)
                localStorage.setItem('role', response.data.role)
                onLogin(response.data.token, response.data.role)

            } else {
                setError(response.data.message || 'Login failed. Please try again.')
            }
        } catch (err) {
            setError('Error connecting to server. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='admin-login'>
            <div className='admin-login-box'>

                <img src={assets.hotmeal2} alt='HotMeal' className='admin-login-logo' />
                <h2>Admin Panel</h2>
                <p className='admin-login-subtitle'>Sign in to continue</p>

                <form onSubmit={onSubmitHandler} className='flex-col'>

                    <div className='admin-login-field flex-col'>
                        <p>Email</p>
                        <input
                            type='email'
                            name='email'
                            placeholder='admin@example.com'
                            value={data.email}
                            onChange={onChangeHandler}
                            required
                        />
                    </div>

                    <div className='admin-login-field flex-col'>
                        <p>Password</p>
                        <input
                            type='password'
                            name='password'
                            placeholder='Password'
                            value={data.password}
                            onChange={onChangeHandler}
                            required
                        />
                    </div>

                    {error && <p className='admin-login-error'>{error}</p>}

                    <button type='submit' className='admin-login-btn' disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                </form>
            </div>
        </div>
    )
}

export default Login
