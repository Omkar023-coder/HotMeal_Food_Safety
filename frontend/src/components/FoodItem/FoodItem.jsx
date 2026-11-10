import React, { useContext } from 'react'
import './FoodItem.css'
import { assets } from '../../assets/assets'
import { StoreContext } from '../context/StoreContext'
import { useNavigate } from 'react-router-dom'

const FoodItem = ({ id, name, price, description, image, restaurantId }) => {

    const { cartItems, addToCart, removeFromCart, url, token } = useContext(StoreContext)
    const navigate = useNavigate()

    return (
        <div className='food-item'>
            <div className="food-item-img-container">
                <img className='food-item-image' src={url + '/images/' + image} alt={name} />
                {token ? (
                    !cartItems[id]
                        ? <img className='add' onClick={() => addToCart(id)} src={assets.add_icon_white} alt="Add to cart" />
                        : <div className="food-item-counter">
                            <img onClick={() => removeFromCart(id)} src={assets.remove_icon_red} alt="Remove" />
                            <p>{cartItems[id]}</p>
                            <img onClick={() => addToCart(id)} src={assets.add_icon_green} alt="Add more" />
                        </div>
                ) : null}
            </div>

            <div className="food-item-info">
                <div className="food-item-name-rating">
                    <p>{name}</p>
                    <img src={assets.rating_starts} alt="rating" />
                </div>

                {restaurantId?.name && (
                    <div className='food-item-restaurant-row'>
                        <p className="food-item-restaurant">{restaurantId.name}</p>
                        {restaurantId._id && (
                            <button
                                className='food-item-safety-btn'
                                onClick={() => navigate(`/restaurant/${restaurantId._id}/safety`)}
                                title={`View safety information for ${restaurantId.name}`}
                            >
                                🛡️ Safety
                            </button>
                        )}
                    </div>
                )}

                <p className="food-item-desc">{description}</p>
                <p className="food-item-price">₹{price}</p>
            </div>
        </div>
    )
}

export default FoodItem
