<template>
    <ion-page>
        <ion-header>
            <ion-toolbar>
                <ion-buttons slot="start">
                    <!-- Back button to navigate back one page -->
                    <ion-button @click="$router.go(-1)">
                        <ion-icon color="primary" name="back-button" size="small"></ion-icon>
                    </ion-button>
                </ion-buttons>

                <ion-buttons slot="end">
                    <!-- Profile button - show if either Midax is enabled or loyalty number exists -->
                    <ion-button @click="presentUserProfileModal" v-if="hasMidaxCoupons || loyaltyNumber">
                        <ion-icon color="primary" name="my-account-regular" size="small"></ion-icon>
                    </ion-button>
                </ion-buttons>

                <ion-title><ion-img class="app-toolbar-image" :src="logoUrl"></ion-img></ion-title>
            </ion-toolbar>
        </ion-header>
        <ion-content :fullscreen="true">
            <h1 class="user-welcome-heading ion-padding">Hi, {{ userName || "Shopper" }}!</h1>
            <!-- Display loyalty number if it exists -->
            <div class="loyalty-card">
                <div class="loyalty-label">My Loyalty Number</div>
                <div class="loyalty-number" v-if="hasMidaxCoupons" >{{ cardNumber  || 'Not Available' }}</div>
                <div class="loyalty-number" v-if="loyaltyNumber">{{ formatPhone(loyaltyNumber) }}</div>
            </div>

            <!-- Display card number only when Midax coupons are enabled
            <div class="loyalty-card" v-if="hasMidaxCoupons">
                <div class="loyalty-label">My Card Number</div>
                <div class="loyalty-number" v-if="hasMidaxCoupons" >{{ cardNumber  || 'Not Available' }}</div>
            </div> -->

            <!-- Stats Grid -->
            <div class="stats-grid" v-if="hasAppCardCoupons && offerStats">
                <div class="stat-card">
                    <div class="stat-label">Total Saved</div>
                    <div class="stat-value">${{ offerStats.totalSaved.toFixed(2) }}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Clipped</div>
                    <div class="stat-value">{{ offerStats.totalClippedCount }}</div>
                </div>
            </div>

            <!-- Display barcode if loyalty number exists -->
            <div class="loyalty-card" v-if="loyaltyNumber">
                <div class="loyalty-card-details">Please present this barcode to the cashier to redeem your coupons.</div>
                <div class="barcode-container ion-margin-top">
                    <vue-barcode :value="loyaltyNumber" :options="{
                        format: 'CODE128',
                        width: 2.5,
                        height: 50,
                        displayValue: false,
                        background: '#f7f7f7',
                        lineColor: '#000000',
                        margin: 10
                    }" @render="onBarcodeRender"></vue-barcode>
                </div>
            </div>

            <!-- Auth0 Logout button, visible only when Midax coupons are enabled -->
            <ion-button @click="handleAuth0Logout" expand="block" color="danger" class="close-account-button"
                v-if="hasMidaxCoupons">Log Out</ion-button>

            <!-- Button to open the contact form, visible only if loyalty number exists -->
            <ion-button @click="openContactForm" expand="block" color="danger" class="close-account-button"
                v-if="loyaltyNumber">Close My Account</ion-button>

            <UserProfileDetailsModal :is-open="showUserProfileModal" @update:is-open="showUserProfileModal = $event" />
        </ion-content>
    </ion-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonContent, IonButtons, IonButton, IonIcon, IonImg, alertController } from '@ionic/vue';
import { Browser } from '@capacitor/browser';
import { useSignupModal } from '@/composables/useSignupModal';
import UserProfileDetailsModal from '@/components/UserProfileDetailsModal.vue';
import VueBarcode from '@chenfengyuan/vue-barcode';
import CouponsApi from '@/axios/apiCoupons';
import CustomerApi from '@/axios/apiCustomer';
import { useAuthModule } from '@/composables/useAuth0Modal';
import { useRouter } from 'vue-router';
import { isPlatform } from '@ionic/vue';
import { callbackUri } from '@/main';
import { useAuth0 } from '@auth0/auth0-vue';
import { TokenStorage } from '@/utils/tokenStorage';
import { useClippedCoupons } from '@/composables/useClippedCoupons';

// Importing method to fetch loyalty number from a composable
const { getLoyaltyNumber } = useSignupModal();
const { signOut } = useAuthModule();
const { clippedCoupons } = useClippedCoupons();
const loyaltyNumber = ref('');
const cardNumber = ref(localStorage.getItem('CardNumber') || '');
const logoUrl = ref(import.meta.env.VITE_PRIMARY_LOGO);
const showUserProfileModal = ref(false);
const userName = ref('');
const offerStats = ref(null);
const hasAppCardCoupons = ref(true); 
const hasMidaxCoupons = ref(import.meta.env.VITE_HAS_MIDAX_COUPONS === "true");

const router = useRouter();
const { logout } = useAuth0();

// Computed property to check if user is authenticated
const isAuthenticated = computed(() => {
    if (hasMidaxCoupons.value) {
        return !!localStorage.getItem('access_token') && !!localStorage.getItem('storeId');
    }
    return !!loyaltyNumber.value;
});

// Update presentUserProfileModal to check authentication
const presentUserProfileModal = () => {
    if (hasMidaxCoupons.value || loyaltyNumber.value) {
        showUserProfileModal.value = true;
    }
};

// Set loyalty number on component mount and add event listener
onMounted(async () => {
    loyaltyNumber.value = getLoyaltyNumber();
    cardNumber.value = localStorage.getItem('CardNumber');
    userName.value = localStorage.getItem('firstName') || '';

    // Fetch customer info and offer details
    try {
        if (import.meta.env.VITE_HAS_MIDAX_COUPONS === "true") {
            const currentToken = localStorage.getItem('access_token');
            const storeId = localStorage.getItem('storeId') || '201949';
            
            if (currentToken && storeId) {
                const customerResponse = await CustomerApi.checkForExistingUser(currentToken, storeId);
                if (customerResponse.data && customerResponse.data[0]) {
                    userName.value = customerResponse.data[0].FirstName || '';
                }
            }
        } else {
            const [customerInfo, offerDetails] = await Promise.all([
                CouponsApi.getCustomerInfo(),
                CouponsApi.getOfferDetails()
            ]);
            userName.value = customerInfo.FirstName || '';
            offerStats.value = offerDetails;
        }
    } catch (error) {
        console.error('Failed to fetch data:', error);
    }

    // Update loyalty number if a 'userSignedUp' event is emitted
    window.addEventListener('userSignedUp', (event) => {
        loyaltyNumber.value = event.detail.loyaltyNumber;
        cardNumber.value = event.detail.cardNumber;
    });
});

// Clean up event listener on component unmount
onUnmounted(() => {
    window.removeEventListener('userSignedUp', (event) => {
        loyaltyNumber.value = event.detail.loyaltyNumber;
        cardNumber.value = event.detail.cardNumber;
    });
});

// Function to open the contact form URL in a browser popover
const openContactForm = async () => {
    await Browser.open({
        url: import.meta.env.VITE_CONTACT_URL,
        presentationStyle: 'popover'
    });
};

// Function to format phone numbers to a standard format
const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

const isBarcodeDisplayed = ref(false);

const showBarcode = () => {
    isBarcodeDisplayed.value = true;
};

const closeBarcode = () => {
    isBarcodeDisplayed.value = false;
};

const onBarcodeRender = () => {
    // Barcode render callback
};

// Function to handle Auth0 logout
const handleAuth0Logout = async () => {
    try {
        // Clear clipped coupons from memory before sign out
        clippedCoupons.value = new Set();
        localStorage.removeItem('clippedCoupons');
        
        // Use the signOut method from useAuthModule which handles token clearing and Auth0 logout
        await signOut();
        
        // Force a complete app refresh to reset UI state and go to homepage
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        
        // Even if the Auth0 logout fails, ensure tokens are cleared
        TokenStorage.clearTokens();
        
        // Clear clipped coupons as a fallback
        clippedCoupons.value = new Set();
        localStorage.removeItem('clippedCoupons');
        
        // Force a complete app refresh even in error case
        window.location.href = '/';
    }
};

// Register the component
defineOptions({
    components: {
        VueBarcode
    }
});
</script>

<style scoped>
/* Styling for the loyalty card */
.loyalty-card {
    background: var(--ion-color-light);
    margin: 16px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--ion-color-light-shade);
}

/* Styling for the loyalty label text */
.loyalty-label {
    color: var(--ion-color-medium);
    font-size: 14px;
    margin-bottom: 4px;
}

/* Styling for the loyalty number text */
.loyalty-number {
    color: var(--ion-color-dark);
    font-size: 18px;
    font-weight: 600;
}

.loyalty-card-details {
    color: var(--ion-color-medium);
    font-size: 18px;
    font-weight: 600;
}

/* Styling for the close account button */
.close-account-button {
    margin-top: 65px;
    max-width: 95%;
    margin: 65px auto 0 auto;
}

/* Add some spacing between the cards */
.loyalty-card+.loyalty-card {
    margin-top: 8px;
}

.barcode-container {
    /* background: white; */
    padding: 10px;
    border-radius: 8px;
    margin-top: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.user-welcome-heading {
    font-weight: 800;
    text-transform: capitalize;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin: 16px;
}

.stat-card {
    background: var(--ion-color-light);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--ion-color-light-shade);
    text-align: center;
}

.stat-label {
    color: var(--ion-color-medium);
    font-size: 14px;
    margin-bottom: 4px;
}

.stat-value {
    color: var(--ion-color-dark);
    font-size: 18px;
    font-weight: 600;
}
</style>
