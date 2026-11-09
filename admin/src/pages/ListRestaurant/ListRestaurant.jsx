import React, { useEffect, useState } from 'react'
import './ListRestaurant.css'
import axios from 'axios'
import { toast } from 'react-toastify'

const ListRestaurant = ({ url }) => {

    const [list, setList] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchList = async () => {
        setLoading(true)
        try {
            const response = await axios.get(`${url}/api/restaurant/list`)
            if (response.data.success) {
                setList(response.data.data)
            } else {
                toast.error('Error fetching restaurants')
            }
        } catch (error) {
            toast.error('Error connecting to server')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchList()
    }, [])

    return (
        <div className='list-restaurant add flex-col'>
            <p>All Restaurants</p>
            <div className='list-restaurant-table'>

                <div className='list-restaurant-format title'>
                    <b>Name</b>
                    <b>Address</b>
                    <b>City</b>
                    <b>State</b>
                    <b>Pincode</b>
                    <b>Phone</b>
                    <b>Cuisine</b>
                    <b>Status</b>
                </div>

                {loading ? (
                    <p className='list-restaurant-message'>Loading...</p>
                ) : list.length === 0 ? (
                    <p className='list-restaurant-message'>No restaurants found. Add one to get started.</p>
                ) : (
                    list.map((item, index) => (
                        <div key={index} className='list-restaurant-format'>
                            <p>{item.name}</p>
                            <p>{item.address}</p>
                            <p>{item.city}</p>
                            <p>{item.state}</p>
                            <p>{item.pincode}</p>
                            <p>{item.phone}</p>
                            <p>{item.cuisine}</p>
                            <p className={`status-badge status-${item.status?.toLowerCase()}`}>
                                {item.status}
                            </p>
                        </div>
                    ))
                )}

            </div>
        </div>
    )
}

export default ListRestaurant
