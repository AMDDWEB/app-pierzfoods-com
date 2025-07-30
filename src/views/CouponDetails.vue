<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="$router.go(-1)">
            <ion-icon slot="icon-only" color="primary" name="back-button" class="toolbar-icon"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>Coupon Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content color="light">
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
      </div>

      <div v-else-if="coupon" class="coupon-details">
        <!-- White background container -->
        <div class="white-container ion-padding-top">
          <!-- Image -->
          <ion-img 
            v-if="coupon.encoded_img" 
            :src="coupon.encoded_img"
            :alt="coupon.title"
          ></ion-img>
          <ion-spinner v-else name="lines"></ion-spinner>

          <!-- Basic Info -->
          <div class="ion-padding-top ion-text-center">
            <p class="coupon-brand">{{ coupon.subtitle }}</p>
            <p class="coupon-value">{{ coupon.title }}</p>
            <p class="coupon-expiration">
              Expires {{ formatExpDate(coupon.to_date) }}
            </p>
          </div>

          <!-- Description -->
          <ion-item lines="full">
            <ion-label>
              <b>Coupon Details</b>
              <p class="ion-padding-top">
                {{ coupon.title }} {{ coupon.description }}
              </p>
            </ion-label>
          </ion-item>
        </div>

        <!-- Terms and Conditions -->
        <div v-if="coupon.disclaimer">
          <ion-item lines="none">
            <ion-label>
              <b>Terms and Conditions</b>
              <p class="ion-padding-top">
                {{ coupon.disclaimer }}
              </p>
            </ion-label>
          </ion-item>
        </div>

        <!-- Clip Button - Moved here from toolbar -->
        <div class="ion-padding">
          <ion-button
            expand="block"
            :color="isCouponClipped(coupon?.id) ? 'success' : 'secondary'"
            :disabled="isClipping"
            @click="handleClipClick"
          >
            <div v-if="isClipping" class="button-content">
              <ion-spinner name="lines"></ion-spinner>
            </div>
            <div v-else class="button-content">
              <ion-icon :icon="isCouponClipped(coupon?.id) ? checkmark : cut"></ion-icon>
              {{ isCouponClipped(coupon?.id) ? 'Clipped' : 'Clip Coupon' }}
            </div>
          </ion-button>
        </div>
      </div>

      <div v-else class="error-message">
        <h3>Coupon not found</h3>
        <p>The coupon you're looking for might have expired or been removed.</p>
      </div>
    </ion-content>

    <SignupModal />
  </ion-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { format } from 'date-fns';
import { 
  IonPage, IonHeader, IonToolbar, IonContent,
  IonButton, IonButtons, IonTitle, IonIcon,
  IonSpinner, IonCard, IonImg
} from '@ionic/vue';
import { cut, calendarOutline, arrowBackOutline } from 'ionicons/icons';
import { useSignupModal } from '@/composables/useSignupModal';
import { useClippedCoupons } from '@/composables/useClippedCoupons';
import CouponsApi from '@/axios/apiCoupons';
import { TokenStorage } from '@/utils/tokenStorage';

const props = defineProps({
  id: {
    type: String,
    required: true
  }
});

const loading = ref(true);
const coupon = ref(null);
const isClipping = ref(false);

const { openSignupModal, SignupModal } = useSignupModal();
const { isCouponClipped, addClippedCoupon, syncClippedCoupons } = useClippedCoupons();

const formatExpDate = (date) => format(new Date(date), 'MM/dd/yyyy');

const fetchCouponDetails = async () => {
  try {
    loading.value = true;
    
    // Get locationId for Midax system
    const locationId = localStorage.getItem('storeId');
    if (!locationId) {
      throw new Error('No store ID found in localStorage');
    }
    
    // Call the updated getCouponById with locationId and offerId
    const response = await CouponsApi.getCouponById(locationId, props.id);
    
    // Fix: The API returns an array, so we need to get the first item
    let couponData = null;
    if (response.data && Array.isArray(response.data)) {
      couponData = response.data[0];  // Get first item from array
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      couponData = response.data.data[0];  // Get first item from nested array
    }
    
    if (couponData) {
      coupon.value = couponData;
      // Sync this coupon with clipped coupons to ensure it's still valid
      syncClippedCoupons([couponData]);
    }
  } catch (error) {
    console.error('Error fetching coupon details:', error);
    // Handle error silently
  } finally {
    loading.value = false;
  }
};

const handleClipClick = async () => {
  // For Midax, check for card number
  const hasMidaxCoupons = import.meta.env.VITE_HAS_MIDAX_COUPONS === "true";
  
  if (hasMidaxCoupons) {
    // Check for card number
    let cardNumber = localStorage.getItem('CardNumber');
    const storeId = localStorage.getItem('storeId');
    const accessToken = localStorage.getItem('accessToken') || localStorage.getItem('access_token');
    
    if ((!cardNumber || !storeId) && !accessToken) {
      openSignupModal();
      return;
    }
  } else {
    // For AppCard, check tokens
    if (!TokenStorage.hasTokens()) {
      openSignupModal();
      return;
    }
  }

  if (isClipping.value) return;

  isClipping.value = true;
  try {
    const response = await CouponsApi.clipCoupon(props.id);
    // If we get here without an error, the clip was successful
    addClippedCoupon(props.id);
  } catch (error) {
    console.error('Error clipping coupon:', error);
  } finally {
    isClipping.value = false;
  }
};

onMounted(() => {
  fetchCouponDetails();
});
</script>

<style scoped>
.white-container {
  background: #fff;
}

ion-img {
  height: 250px;
}

.coupon-brand {
  margin-bottom: 0;
}

.coupon-value {
  font-weight: bold;
  color: #ec0000;
  padding: 0;
  margin: 5px 0;
  text-transform: uppercase;
}

.coupon-expiration {
  color: var(--ion-color-medium-tint);
  font-size: 12px;
  margin-top: 4px;
}

.button-content {
  align-items: center;
  display: flex;
}

ion-button {
  height: 40px;
}

ion-icon {
  font-size: 24px;
  margin-right: 6px;
}

ion-spinner {
  height: 16px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.error-message {
  text-align: center;
  padding: 32px;
  color: var(--ion-color-medium);
}

.error-message h3 {
  margin-bottom: 8px;
}
</style>