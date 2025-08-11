import { ref, computed } from 'vue'
import Coupons from '@/axios/apiCoupons'

const coupons = ref([]);
const loading = ref(false);
const categories = ref([]);
const selectedSort = ref('newest');
const allCoupons = ref([]);
const isMidax = ref(import.meta.env.VITE_HAS_MIDAX_COUPONS === "true");

export function useCouponDetails() {
  const fetchCoupons = async ({
    limit = isMidax.value ? 20 : 1000,
    offset = 0,
    category = null
  } = {}) => {
    try {
      if (offset === 0) {
        loading.value = true;
      }

      const locationId = localStorage.getItem('storeId') || '201949';

      const response = await Coupons.getCoupons(
        limit,
        offset,
        locationId,
        selectedSort.value,
        category
      );

      if (offset === 0) {
        // Reset coupons if this is the first batch
        coupons.value = response.data?.items || response.data || [];
      } else if (isMidax.value) {
        // Append new coupons only for Midax, ensuring no duplicates
        const newCoupons = response.data?.items || response.data || [];
        const existingIds = new Set(coupons.value.map(coupon => coupon.id));
        const uniqueNewCoupons = newCoupons.filter(coupon => !existingIds.has(coupon.id));
        coupons.value = [...coupons.value, ...uniqueNewCoupons];
      }

      return response;
    } catch (error) {
      console.error('Error fetching coupons:', error);
      return { data: { items: [] } };
    } finally {
      if (offset === 0) {
        loading.value = false;
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const locationId = localStorage.getItem('storeId') || '201949';
      
      // Fetch categories from the API endpoint
      const categoriesResponse = await Coupons.getCouponCategories(locationId);
      
      // Extract category names from the API response
      const categoryNames = categoriesResponse.data?.map(category => category.Name) || [];
      
      // Set categories with 'All Coupons' first, then the API categories
      categories.value = ['All Coupons', ...categoryNames];
      
    } catch (error) {
      console.error('Error fetching categories:', error);
      categories.value = ['All Coupons'];
    }
  };

  const availableCategories = computed(() => categories.value);

  return {
    coupons,
    loading,
    fetchCoupons,
    fetchCategories,
    availableCategories,
    isMidax
  };
} 