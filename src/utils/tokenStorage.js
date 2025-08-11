import CustomerApi from '../axios/apiCustomer';

export const TokenStorage = {
  // Local Storage Based Methods
  getAccessToken() {
    return localStorage.getItem('access_token');
  },

  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },

  async setTokens(accessToken, refreshToken) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    
    // Get the current access token and storeId from localStorage
    const token = localStorage.getItem('access_token');
    const storeId = localStorage.getItem('storeId') || '201949';
    
    if (token && storeId) {
      try {
        const response = await CustomerApi.checkForExistingUser(token, storeId);
        if (import.meta.env.VITE_HAS_MIDAX_COUPONS === "true") {
          if (response.data && response.data[0] && response.data[0].cardNumber) {
            localStorage.setItem('cardNumber', response.data[0].cardNumber);
          }
        }
      } catch (error) {
        console.error('Error checking for existing user:', error);
      }
    }

    // Dispatch an event to notify other components
    window.dispatchEvent(new Event('tokensUpdated'));
  },

  clearTokens() {
    // Clear all auth-related tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refresh_token');
    
    // Clear user-related data
    localStorage.removeItem('cardNumber');
    localStorage.removeItem('firstName');
    localStorage.removeItem('userData');
    localStorage.removeItem('clippedCoupons');
    
    // Note: We don't clear storeId or selectedLocation as they are store preferences, not auth data
    
    // Dispatch an event to notify other components
    window.dispatchEvent(new Event('tokensUpdated'));
  },

  hasTokens() {
    return !!(this.getAccessToken() && this.getRefreshToken());
  },

  // Bearer Token Method
  setAuthToken: async (accessToken, request) => {
    if (request && request.defaults) {
      request.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      return request.defaults.headers.common['Authorization'];
    }
  }
}; 