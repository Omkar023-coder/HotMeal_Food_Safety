import React, { useContext } from 'react'
import './FoodDisplay.css'
import { StoreContext } from '../context/StoreContext'
import FoodItem from '../FoodItem/FoodItem'

const FoodDisplay = ({category}) => {

    const {food_list,token} = useContext(StoreContext)
  return (
    <div className='food-display' id='food-display'>
        <h2>Top dishes near you</h2>
        {!token && (<div className='login-prompt'>Discover flavors waiting to delight you. Sign up or log in now to enable your cart and start ordering!</div>)}
        <div className="food-display-list">
            {food_list.map((item,index)=>{
              if(category==='All' || category===item.category){
                return <FoodItem key={index} id={item._id} name={item.name} description={item.description} price={item.price} image={item.image}/>
              }
                            })}
        </div>
    </div>
  )
}

export default FoodDisplay