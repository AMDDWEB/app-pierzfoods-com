<template>
  <ion-card @click="handleCardClick">
    <!-- Image Container -->
    <ion-img v-if="decodedImageSrc" class="coupon-image-container" :src="decodedImageSrc"></ion-img>
    <div v-else class="coupon-image-container">
      <ion-spinner name="lines"></ion-spinner>
    </div>

    <!-- Text Content -->
    <span class="coupon-brand truncate">{{ coupon.subtitle }}</span>
    <ion-card-title class="coupon-value ion-text-center truncate">{{ coupon.title }}</ion-card-title>
    <span class="coupon-description truncate-multiline">{{ coupon.description }}</span>
    <span class="coupon-expiration ion-text-center">Expires {{ formatExpDate(coupon.to_date) }}</span>

    <!-- Button -->
    <ion-button
      size="small"
      :color="isCouponClipped(coupon.id) ? 'success' : 'danger'"
      fill="solid"
      :disabled="isCouponClipped(coupon.id)"
      @click.stop="handleClipClick">
      <ion-icon slot="start" name="coupons-regular" />
      {{ isCouponClipped(coupon.id) ? 'Clipped' : 'Clip Coupon' }}
    </ion-button>
  </ion-card>


  <!-- Coupon Modal -->
  <ion-modal :is-open="showCouponModal" @didDismiss="closeCouponModal" :swipe-to-close="false" :backdropDismiss="true">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-button @click="closeCouponModal">Close</ion-button>
        </ion-buttons>
        <ion-title>Coupon Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-segment class="coupon-details-segment" v-model="selectedSegment">
        <ion-segment-button value="details">
          <ion-label>Details</ion-label>
        </ion-segment-button>
        <ion-segment-button value="terms">
          <ion-label>Terms</ion-label>
        </ion-segment-button>
      </ion-segment>

      
      <div class="coupon-details-card" v-if="selectedSegment === 'details'">
        <span class="coupon-details-label">{{ coupon.title }} on {{ coupon.subtitle }}</span><br>
        <span class="coupon-details-text">{{ coupon.description }}</span>
      </div>
      <ion-img v-if="decodedImageSrc && selectedSegment === 'details'" class="coupon-details-image" :src="decodedImageSrc"></ion-img>

      <div class="coupon-details-card" v-if="selectedSegment === 'terms'">
        <span class="coupon-details-label">Coupon Expires on {{ formatExpDate(coupon.to_date) }}</span><br>
        <span class="coupon-details-text">{{ coupon.disclaimer }}</span>
      </div>
    </ion-content>
  </ion-modal>

  <!-- Signup Modal -->
  <SignupModal v-if="hasAppCardCoupons" />
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue';
import { format } from 'date-fns';
import { IonCard, IonCardTitle, IonImg, IonIcon, IonButton, IonText, IonSpinner, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/vue';
import { cut } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { useSignupModal } from '@/composables/useSignupModal';
import { useAuthModule } from '@/composables/useAuth0Modal';
import { useClippedCoupons } from '@/composables/useClippedCoupons';
import Coupons from '@/axios/apiCoupons';
import { TokenStorage } from '@/utils/tokenStorage';

const router = useRouter();
const props = defineProps({
  coupon: {
    type: Object,
    required: true
  }
});

const hasAppCardCoupons = ref(import.meta.env.VITE_HAS_APPCARD_COUPONS === "true");
const hasMidaxCoupons = ref(import.meta.env.VITE_HAS_MIDAX_COUPONS === "true");

const emit = defineEmits(['click', 'clip', 'clipped']);
const { openSignupModal, SignupModal } = useSignupModal();
const { signIn, signOut } = useAuthModule();
const { addClippedCoupon, isCouponClipped, showErrorAlert, closeErrorAlert, errorMessage } = useClippedCoupons();
const isClipping = ref(false);
const showCouponModal = ref(false);
const selectedSegment = ref('details');


const formatExpDate = (date) => format(new Date(date), 'MM/dd/yyyy');

const decodedImageSrc = computed(() => {
  if (!props.coupon?.encoded_img) return '';
  
  try {
    // Check if it's already a data URL
    if (props.coupon.encoded_img.startsWith('data:image')) {
      return props.coupon.encoded_img;
    }
    
    // Check if it's a URL
    if (props.coupon.encoded_img.startsWith('http')) {
      return props.coupon.encoded_img;
    }
    
    // Try to decode base64
    const cleanBase64 = props.coupon.encoded_img.replace(/[\n\r]/g, '').trim();
    
    // If it doesn't have a mime type, assume it's a JPEG
    if (!cleanBase64.includes('data:image')) {
      return `data:image/jpeg;base64,${cleanBase64}`;
    }
    
    return cleanBase64;
  } catch (error) {
    console.error('Error decoding image:', error);
    return '';
  }
});

const handleCardClick = () => {
  showCouponModal.value = true;
};

const closeCouponModal = () => {
  showCouponModal.value = false;  // Resets the modal state properly after close
};

const handleClipClick = async (event) => {
  event.stopPropagation(); // Prevent the card click event

  // Don't proceed if already clipping or clipped
  if (isClipping.value || isCouponClipped(props.coupon.id)) return;

  isClipping.value = true;
  try {
    // Check for both CardNumber and cardNumber
    let cardNumber = localStorage.getItem('CardNumber') || localStorage.getItem('cardNumber');
    if (!cardNumber) {
      // Remove only relevant items, not storeId
      localStorage.removeItem('accessToken');
      localStorage.removeItem('access_token');
      localStorage.removeItem('CardNumber');
      localStorage.removeItem('cardNumber');
      // await signOut();
      await signIn();
      isClipping.value = false;
      return;
    }

    // We have card number, proceed with clipping
    const couponData = {
      offer_id: props.coupon.id.toString(),
      app_id: import.meta.env.VITE_APP_ID,
      provider: props.coupon.provider
    };
    
    const response = await Coupons.clipCoupon(cardNumber, couponData);
    if (response) {
      addClippedCoupon(props.coupon.id);
      emit('clipped', props.coupon);
    }
  } catch (error) {
    console.error('Error clipping coupon:', error);
    if (error.isOfferUnavailable) {
      // Show the error message from the API
      showErrorAlert.value = true;
      // The error message is already set in the API call
    } else {
      // For other errors, show a generic error
      showErrorAlert.value = true;
      errorMessage.value = 'Failed to clip coupon. Please try again.';
    }
  } finally {
    isClipping.value = false;
  }
};
</script>

<style scoped>
/* Styles maintained as requested */
ion-card {
  padding-top: 10px;
  margin: 0 4px;
  border: 2px dashed var(--ion-color-light-shade);
  box-shadow: none;
  height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 8px;
}

.coupon-image-container {
  height: 100px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.coupon-brand {
  font-size: 12px;
  text-align: center;
  margin-top: 10px;
  color: var(--ion-color-medium-shade);
}

.coupon-value {
  font-weight: bold;
  font-size: 16px;
  color: var(--ion-color-danger);
  padding: 0;
  margin: 5px 0;
}

.coupon-description {
  font-size: 12px;
  margin: 0 10px;
  text-align: center;
  overflow: hidden;
  min-height: 42px;
}

.coupon-expiration {
  color: var(--ion-color-medium-shade);
  font-size: 12px;
  margin: 4px 0;
}

ion-button {
  margin: 5px 10px;
  height: 32px;
  --border-width: 1.5px;
  width: 90%;
}

ion-icon {
  margin-right: 4px;
  font-size: 12px;
}

.coupon-details-segment {
  margin-left: auto;
  margin-right: auto;
  width: 60%;
  margin-top: 20px;
  align-items: center;
}

.coupon-details-card {
  background: var(--ion-color-light);
  margin: 16px;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.coupon-details-label {
  color: var(--ion-color-medium);
  font-size: 14px;
  margin-bottom: 4px;
}

.coupon-details-text {
  color: var(--ion-color-dark);
  font-size: 16px;
  font-weight: 600;
}

.coupon-details-image {
  height: auto;
  width: 65%;
  display: block;
  margin-left: auto;
  margin-right: auto;
  margin-top: 25px;
}
</style>