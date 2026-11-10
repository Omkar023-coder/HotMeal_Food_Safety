import React, { useState } from 'react'
import Navbar from './components/Navbar/Navbar'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home/Home'
import Cart from './pages/Cart/Cart'
import PlaceOrder from './pages/PlaceOrder/PlaceOrder'
import Footer from './components/Footer/Footer'
import LoginPopup from './components/LoginPopup/LoginPopup'
import AdminLoginPopup from './components/AdminLoginPopup/AdminLoginPopup'
import MyOrders from './pages/MyOrders/MyOrders'
import RestaurantSafety from './pages/RestaurantSafety/RestaurantSafety'

const App = () => {

    const [showLogin, setShowLogin] = useState(false);
    const [showAdminLogin, setShowAdminLogin] = useState(false);

    return (
        <>
            {/* Customer login modal */}
            {showLogin && <LoginPopup setShowLogin={setShowLogin} />}

            {/* Admin login modal — separate, only opens Admin Panel */}
            {showAdminLogin && <AdminLoginPopup setShowAdminLogin={setShowAdminLogin} />}

            <div className='app'>
                <Navbar
                    setShowLogin={setShowLogin}
                    setShowAdminLogin={setShowAdminLogin}
                />
                <Routes>
                    <Route path='/' element={<Home />} />
                    <Route path='/cart' element={<Cart />} />
                    <Route path='/order' element={<PlaceOrder />} />
                    <Route path='/myorders' element={<MyOrders />} />
                    <Route path='/restaurant/:restaurantId/safety' element={<RestaurantSafety />} />
                </Routes>
            </div>
            <Footer />
        </>
    )
}

export default App
