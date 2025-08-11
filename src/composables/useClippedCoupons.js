import { ref, onMounted, onUnmounted } from 'vue';
import CouponsApi from '@/axios/apiCoupons';

// Initialize with empty set - we'll load from API
const clippedCoupons = ref(new Set());

// State for loading and errors
const isLoading = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref('This coupon is no longer available or has reached its maximum usage.');

// Track if we've loaded the initial data
const hasLoadedInitial = ref(false);

export function useClippedCoupons() {
  // Set up event listeners for coupon errors
  onMounted(() => {
    window.addEventListener('couponError', handleCouponError);
    // Load clipped coupons when the component mounts
    loadClippedCoupons();
  });

  onUnmounted(() => {
    window.removeEventListener('couponError', handleCouponError);
  });

  const handleCouponError = (event) => {
    errorMessage.value = event.detail?.message || 'This coupon is no longer available!';
    showErrorAlert.value = true;
  };
  
  const closeErrorAlert = () => {
    showErrorAlert.value = false;
  };

  // Load clipped coupons from the API
  const loadClippedCoupons = async () => {
    const currentStoreId = localStorage.getItem('storeId') || '201949';
    const currentCardNumber = localStorage.getItem('CardNumber');
    
    if (!currentCardNumber?.trim() || !currentStoreId?.trim()) {
      console.log('Missing required data for loading clipped coupons');
      return false;
    }

    if (isLoading.value) {
      console.log('Already loading clipped coupons');
      return false;
    }

    isLoading.value = true;
    
    try {
      const sortBy = 'expires';
      const limit = 100;
      const offset = 0;
      
      console.log('Loading clipped coupons with:', { 
        cardNumber: currentCardNumber, 
        offset, 
        limit, 
        sortBy, 
        locationId: currentStoreId 
      });
      
      const response = await CouponsApi.getClippedCoupons(
        currentCardNumber,
        offset,
        limit,
        sortBy,
        currentStoreId
      );
      
      if (response?.data?.items) {
        // Update the clipped coupons set with the new data
        const newClippedCoupons = new Set(response.data.items.map(item => item.id));
        console.log('Loaded clipped coupons:', Array.from(newClippedCoupons));
        clippedCoupons.value = newClippedCoupons;
        hasLoadedInitial.value = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading clipped coupons:', error);
      showErrorAlert.value = true;
      errorMessage.value = 'Failed to load your clipped coupons. Please try again.';
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  const addClippedCoupon = async (couponId) => {
    if (!clippedCoupons.value.has(couponId)) {
      // Create a new Set to trigger reactivity
      const newSet = new Set(Array.from(clippedCoupons.value));
      newSet.add(couponId);
      clippedCoupons.value = newSet;
      
      // No need to persist to localStorage anymore
    }
  };

  const removeClippedCoupon = async (couponId) => {
    if (clippedCoupons.value.has(couponId)) {
      // Create a new Set to trigger reactivity
      const newSet = new Set(Array.from(clippedCoupons.value));
      newSet.delete(couponId);
      clippedCoupons.value = newSet;
      
      // No need to persist to localStorage anymore
    }
  };

  const isCouponClipped = (couponId) => {
    return clippedCoupons.value.has(couponId);
  };

  // Verify if a coupon is still valid by checking the API
  const verifyCouponValidity = async (couponId) => {
    try {
      const locationId = localStorage.getItem('storeId') || '201949';
      
      const response = await CouponsApi.getCouponByID(locationId, couponId);
      // If we get a response with data, the coupon is still valid
      return !!(response?.data?.[0] || response?.data?.data?.[0]);
    } catch (error) {
      console.error('Error verifying coupon validity:', error);
      return false;
    }
  };

  // Clean up expired coupons by checking each one against the API
  const cleanupExpiredCoupons = async () => {
    const currentClipped = Array.from(clippedCoupons.value);
    const validCoupons = new Set();

    // Check each coupon's validity
    for (const couponId of currentClipped) {
      const isValid = await verifyCouponValidity(couponId);
      if (isValid) {
        validCoupons.add(couponId);
      }
    }

    // Update clipped coupons if any were removed
    if (validCoupons.size !== clippedCoupons.value.size) {
      clippedCoupons.value = validCoupons;
    }
  };

  // Sync clipped coupons - now just adds new ones without removing
  const syncClippedCoupons = (availableCoupons) => {
    if (!availableCoupons || !Array.isArray(availableCoupons)) return;

    // Only add new coupons that are clipped, don't remove any
    const newCouponIds = availableCoupons
      .filter(coupon => isCouponClipped(coupon.id))
      .map(coupon => coupon.id);

    if (newCouponIds.length > 0) {
      const newSet = new Set([...clippedCoupons.value, ...newCouponIds]);
      if (newSet.size !== clippedCoupons.value.size) {
        clippedCoupons.value = newSet;
      }
    }
  };

  return {
    clippedCoupons,
    addClippedCoupon,
    removeClippedCoupon,
    isCouponClipped,
    syncClippedCoupons,
    cleanupExpiredCoupons,
    loadClippedCoupons,
    isLoading,
    hasLoadedInitial,
    showErrorAlert,
    errorMessage,
    closeErrorAlert
  };
} 