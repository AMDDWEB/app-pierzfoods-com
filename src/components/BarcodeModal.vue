<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)"
    :initial-breakpoint="0.5" :breakpoints="[0, 0.5, 1]" :swipe-to-close="false" :backdropDismiss="false">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <!-- Back button to navigate back one page -->
          <ion-button @click="$emit('update:isOpen', false)">
            Close
          </ion-button>
        </ion-buttons>
        <ion-title>Scan at Checkout</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="barcode-card">
      <!-- <span class="barcode-label">My Coupon Card</span><br> -->
      <span class="barcode-details">Please present this card to the cashier to redeem your coupons.</span>
      <vue-barcode class="barcode-container" :value="cardNumber" :options="{
                        format: 'CODE128',
                        width: 2.5,
                        height: 50,
                        displayValue: false,
                        background: '#f7f7f7',
                        lineColor: '#000000',
                        margin: 10
                    }" @render="onBarcodeRender"></vue-barcode>
      </div>
      <!-- <ion-button class="my-account-button" expand="block" @click="$router.push('/my-account')">View My Account</ion-button> -->
    </ion-content>
  </ion-modal>
</template>

<script setup>
import { IonContent, IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton } from '@ionic/vue';
import VueBarcode from '@chenfengyuan/vue-barcode';
import { useSignupModal } from '@/composables/useSignupModal';
import { ref, watchEffect, watch } from 'vue';

// Props and Events
const props = defineProps({
  isOpen: Boolean
});

// Watch for modal open and refresh card number
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    const number = getCardNumber();
    if (number) {
      cardNumber.value = number;
    }
  }
});

defineEmits(['update:isOpen']);

// Barcode Data Handling
const { getCardNumber } = useSignupModal();
const cardNumber = ref('');

// Watch for changes in card number and update immediately
watchEffect(() => {
  const number = getCardNumber();
  if (number) {
    cardNumber.value = number;
  }
});
</script>

<style scoped>
.modal-handle {
  display: none !important;
}
.barcode-card {
    background: var(--ion-color-light);
    margin: 0px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--ion-color-light-shade);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.barcode-label {
    color: var(--ion-color-medium);
    font-size: 14px;
    margin-bottom: 4px;
}

.barcode-details {
    color: var(--ion-color-medium);
    font-size: 18px;
    font-weight: 600;
}

.barcode-container {
    display: flex;
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    margin-top: 10px;
    justify-content: center;
    align-items: center;
}

.barcode-container svg {
    width: 100% !important;
    height: auto !important;
    max-width: none;
}

.barcode {
  margin-top: 24px;
}

.my-account-button {
  margin-top: 65px;
}
</style>