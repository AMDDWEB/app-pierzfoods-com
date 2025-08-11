<template>
  <div class="ion-margin-bottom">
    <ion-list lines="none">
      <ion-item @click="goToCouponsArchive">
        <ion-text>
          <h3 class="app-list-heading">
            Clip & Save Coupons
            <ion-icon style="font-size: 16px;" name="chevron-right" color="medium"></ion-icon>
          </h3>
          <p class="app-list-subheading">Unlock exclusive savings – limited time only!</p>
        </ion-text>
      </ion-item>
    </ion-list>

    <div v-if="!loading">
      <swiper 
        @swiper="onSwiper" 
        :slides-per-view="2.5" 
        :space-between="1" 
        loop
      >
        <swiper-slide v-for="coupon in displayCoupons" :key="coupon.id">
          <CouponCard :coupon="coupon" @click="goToCouponDetails(coupon.id)" @clip="handleClipCoupon(coupon.id)" />
        </swiper-slide>
      </swiper>
      
    </div>
    <div v-else>
      <CouponsSkeleton :count="1" />
    </div>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, ref } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { IonList, IonItem, IonText, IonIcon } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useCouponDetails } from '@/composables/useCouponDetails';
import { useClippedCoupons } from '@/composables/useClippedCoupons';
import CouponCard from './CouponCard.vue';
import CouponsSkeleton from './CouponsSkeleton.vue';
import 'swiper/css';
import { TokenStorage } from '@/utils/tokenStorage';
import CouponsApi from '@/axios/apiCoupons';

const props = defineProps({
  limit: {
    type: Number,
    default: 10
  }
});

const router = useRouter();
const { coupons, loading, fetchCoupons } = useCouponDetails();
const { 
  addClippedCoupon, 
  showErrorAlert, 
  errorMessage, 
  closeErrorAlert, 
  loadClippedCoupons 
} = useClippedCoupons();
const hasMidaxCoupons = ref(true);
const storeId = ref('201949');
const hasStoreId = computed(() => true);

// Only display up to the limit
const displayCoupons = computed(() => coupons.value.slice(0, props.limit));

// Define onSwiper method for Swiper component
const onSwiper = (swiper) => {
  // Store swiper instance if needed for later manipulation
};

// Function to check if we should load coupons and clipped coupons
const loadAllCoupons = async () => {
  const currentStoreId = storeId.value || '201949';
  const currentCardNumber = localStorage.getItem('CardNumber');
  
  // Always refresh coupons using default location
  await fetchCoupons({ limit: props.limit, offset: 0 });
  
  // If user is logged in (has card number), load their clipped coupons
  if (currentCardNumber) {
    await loadClippedCoupons();
  }
};

// Watch for location changes
watch(() => localStorage.getItem('selectedLocation'), async () => {
  await loadAllCoupons();
});

// Watch for authentication changes
watch(() => TokenStorage.hasTokens(), async (isAuthenticated) => {
  if (isAuthenticated) {
    await loadAllCoupons();
  }
});

// Watch for user sign up events (in case of new registration)
window.addEventListener('userSignedUp', async () => {
  await loadAllCoupons();
});

// Handle coupon clipping result
const handleClipCoupon = async (couponId) => {
  if (!TokenStorage.hasTokens()) {
    return;
  }

  try {
    await CouponsApi.clipCoupon(couponId);
    addClippedCoupon(couponId);

    // Find and update the coupon directly without creating a new array
    const coupon = coupons.value.find(coupon => coupon.id === couponId);
    if (coupon) {
      // Use direct property assignment to maintain reactivity
      coupon.clipped = true;
    }
  } catch (error) {
    console.error('Error clipping coupon:', error);
  }
};

const goToCouponDetails = (couponId) => {
  router.push(`/coupons/${couponId}`);
};

const goToCouponsArchive = () => {
  router.push({ name: 'Coupons' });
};

// Handler function for location change events
const handleLocationChanged = async () => {
  await fetchCoupons({ limit: props.limit, offset: 0 });
};

// Handler for storage events
const handleStorageChange = () => {};

onMounted(async () => {
  await loadAllCoupons();
  window.addEventListener('locationChanged', handleLocationChanged);
  window.addEventListener('storage', handleStorageChange);
});

// Clean up event listeners when component is unmounted
onUnmounted(() => {
  window.removeEventListener('locationChanged', handleLocationChanged);
  window.removeEventListener('storage', handleStorageChange);
});
</script>

<style scoped>
.swiper {
  padding-left: 12px;
  padding-right: 0px;
}

.swiper-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
}

h3.app-list-heading {
  font-size: 22px !important;
  font-weight: bold;
  margin-bottom: 0px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.app-list-subheading {
  margin-top: 0px;
  color: var(--ion-color-medium);
  font-size: 14px;
  line-height: 1.4;
}

ion-note {
  color: #000;
  font-weight: bold;
}

@media (max-width: 600px) {
  ion-text {
    font-size: 12px;
  }
}

.no-store-container {
  padding: 0 4px 0 16px;
}

.no-store-card {
  text-align: center;
  height: 125px;
  position: relative;
  padding: 12px;
  margin-right: 10px;
}

.no-store-card h3 {
  color: var(--ion-color-danger);
  font-size: 20px;
  font-weight: bold;
  z-index: 10;
  position: relative;
  margin-top: 20px;
}

.no-store-card p {
  color: var(--ion-color-medium);
  font-size: 16px;
  z-index: 10;
  position: relative;
  margin-top: 0px;
}

.no-store-card .overlay {
  background: #f7f7f7;
  border: 1px #eaeaea solid;
  vertical-align: middle;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 8px;
}
</style>