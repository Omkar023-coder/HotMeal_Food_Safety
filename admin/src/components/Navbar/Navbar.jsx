import React from 'react'
import './Navbar.css'
import { assets } from './../../assets/assets';

const Navbar = ({ onLogout }) => {
  return (
    <div className='navbar'>
      <img className='logo' src={assets.hotmeal2} alt="" />
      <div className='navbar-right'>
        <img src={assets.profile_image} alt="" className="profile" />
        {onLogout && (
          <button onClick={onLogout} className='navbar-logout-btn'>
            Logout
          </button>
        )}
      </div>
    </div>
  )
}

export default Navbar
