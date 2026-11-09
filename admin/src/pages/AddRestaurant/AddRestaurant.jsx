import React, { useState } from 'react'
import './AddRestaurant.css'
import axios from 'axios'
import { toast } from 'react-toastify'

const AddRestaurant = ({ url }) => {

    const [data, setData] = useState({
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        cuisine: ''
    })

    const onChangeHandler = (event) => {
        const name = event.target.name
        const value = event.target.value
        setData(data => ({ ...data, [name]: value }))
    }

    const onSubmitHandler = async (event) => {
        event.preventDefault()
        try {
            const response = await axios.post(`${url}/api/restaurant/add`, data)
            if (response.data.success) {
                setData({
                    name: '',
                    address: '',
                    city: '',
                    state: '',
                    pincode: '',
                    phone: '',
                    cuisine: ''
                })
                toast.success(response.data.message)
            } else {
                toast.error(response.data.message)
            }
        } catch (error) {
            toast.error('Error connecting to server')
        }
    }

    return (
        <div className='add-restaurant'>
            <form className='flex-col' onSubmit={onSubmitHandler}>

                <div className='add-restaurant-field flex-col'>
                    <p>Restaurant Name</p>
                    <input
                        onChange={onChangeHandler}
                        value={data.name}
                        type='text'
                        name='name'
                        placeholder='e.g. The Spice Garden'
                        required
                    />
                </div>

                <div className='add-restaurant-field flex-col'>
                    <p>Address</p>
                    <input
                        onChange={onChangeHandler}
                        value={data.address}
                        type='text'
                        name='address'
                        placeholder='Street address'
                        required
                    />
                </div>

                <div className='add-restaurant-row'>
                    <div className='add-restaurant-field flex-col'>
                        <p>City</p>
                        <input
                            onChange={onChangeHandler}
                            value={data.city}
                            type='text'
                            name='city'
                            placeholder='City'
                            required
                        />
                    </div>
                    <div className='add-restaurant-field flex-col'>
                        <p>State</p>
                        <input
                            onChange={onChangeHandler}
                            value={data.state}
                            type='text'
                            name='state'
                            placeholder='State'
                            required
                        />
                    </div>
                    <div className='add-restaurant-field flex-col'>
                        <p>Pincode</p>
                        <input
                            onChange={onChangeHandler}
                            value={data.pincode}
                            type='text'
                            name='pincode'
                            placeholder='411001'
                            required
                        />
                    </div>
                </div>

                <div className='add-restaurant-row'>
                    <div className='add-restaurant-field flex-col'>
                        <p>Phone</p>
                        <input
                            onChange={onChangeHandler}
                            value={data.phone}
                            type='text'
                            name='phone'
                            placeholder='9876543210'
                            required
                        />
                    </div>
                    <div className='add-restaurant-field flex-col'>
                        <p>Cuisine</p>
                        <input
                            onChange={onChangeHandler}
                            value={data.cuisine}
                            type='text'
                            name='cuisine'
                            placeholder='e.g. Indian, Chinese'
                            required
                        />
                    </div>
                </div>

                <button type='submit' className='add-btn'>ADD</button>

            </form>
        </div>
    )
}

export default AddRestaurant
