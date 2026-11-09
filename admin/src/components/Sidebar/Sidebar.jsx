import React from 'react'
import './Sidebar.css'
import { assets } from '../../assets/assets'
import { NavLink } from 'react-router-dom'

const Sidebar = () => {
  return (
    <div className='sidebar'>
      <div className="sidebar-options">

        {/* Restaurant */}
        <NavLink to='/add-restaurant' className="sidebar-option">
          <img src={assets.add_icon} alt="" />
          <p>Add Restaurant</p>
        </NavLink>

        <NavLink to='/list-restaurant' className="sidebar-option">
          <img src={assets.order_icon} alt="" />
          <p>List Restaurants</p>
        </NavLink>

        {/* Existing Food */}
        <NavLink to='/add' className="sidebar-option">
          <img src={assets.add_icon} alt="" />
          <p>Add Items</p>
        </NavLink>

        <NavLink to='/list' className="sidebar-option">
          <img src={assets.order_icon} alt="" />
          <p>List Items</p>
        </NavLink>

        {/* Orders */}
        <NavLink to='/orders' className="sidebar-option">
          <img src={assets.order_icon} alt="" />
          <p>Orders</p>
        </NavLink>

      </div>
    </div>
  )
}

export default Sidebar