import axios from 'axios'

let coupons

class Coupons {
  constructor() {
    const base = axios.create({
      baseURL: import.meta.env.VITE_COUPONS_API,
      withCredentials: false,
      headers: {
        'Content-type': 'application/json',
        'x-api-key': import.meta.env.VITE_COUPONS_API_KEY
      }
    })
    coupons = base
  }

  async getClippedCoupons(cardNumber, offset, limit, sortBy, locationId) {
    return coupons({
      url: '/card-offers',
      method: 'GET',
      params: {
        card_number: cardNumber,
        offset,
        limit,
        sort_by: sortBy,
        location_id: locationId
      }
    })
  }

  async getCouponCategories(locationId) {
    return coupons({
      url: '/categories',
      method: 'GET',
      params: { location_id: locationId, card_number: 1234 }
    })
  }

  async getCoupons(limit, offset, locationId, sortBy, category) {
    let params = {
      offset,
      limit,
      location_id: locationId,
      sort_by: sortBy
    }
    if (category) params.category_id = category.Id
    return coupons({
      url: `/offers`,
      method: 'GET',
      params: params
    })
  }

  async getItemCoupons(cardNumber, upc) {
    return coupons({
      url: `/offers/item-offers/${cardNumber}`,
      method: 'GET',
      params: upc
    })
  }

  async searchCoupons(limit, offset, locationId, searchTerm) {
    return coupons({
      url: '/search-offers',
      method: 'GET',
      params: {
        limit,
        offset,
        location_id: locationId,
        subtitle: searchTerm
      }
    })
  }

  async getCouponByID(locationId, offerId) {
    return coupons({
      url: '/offer-by-id',
      method: 'GET',
      params: {
        location_id: locationId,
        offer_id: offerId
      }
    })
  }

  async clipCoupon(cardNumber, coupon) {
    try {
      const response = await coupons({
        url: `/offer/${cardNumber}`,
        method: 'POST',
        data: coupon
      });
      return response;
    } catch (error) {
      console.log('Clip coupon error:', error);
      const customError = new Error('This coupon is no longer available or has reached its maximum usage.');
      customError.isOfferUnavailable = true;
      throw customError;
    }
  }


  isAuthenticated() {
    const cardNumber = localStorage.getItem('cardNumber') || localStorage.getItem('CardNumber')
    const storeId = localStorage.getItem('storeId')
    return !!(cardNumber && storeId)
  }

  async getCustomerInfo() {
    const cardNumber = localStorage.getItem('cardNumber') || localStorage.getItem('CardNumber')
    return {
      card_number: cardNumber,
    }
  }

  async updateUserProfile(userProfile, refreshToken) {
    return { success: true }
  }

}

export default new Coupons()
