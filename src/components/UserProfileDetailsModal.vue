<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('update:isOpen', false)" :swipe-to-close="false" :backdropDismiss="false">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <!-- Back button to navigate back one page -->
        </ion-buttons>
        <ion-title>My Account Details</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card class="no-notifications-card">
        <span class="no-notifications-message">Please use the fields below to update your account details.</span>
      </ion-card>

      <form @submit.prevent="submitUserProfile">
        <ion-item lines="none">
          <ion-label position="stacked" color="medium">First Name</ion-label>
          <ion-input class="profile-input" type="text" v-model="userProfile.firstName" required></ion-input>
        </ion-item>
        <ion-item lines="none">
          <ion-label position="stacked" color="medium">Last Name</ion-label>
          <ion-input class="profile-input" type="text" v-model="userProfile.lastName" required></ion-input>
        </ion-item>
        <template v-if="!hasMidaxCoupons">
          <ion-item lines="none">
            <ion-label position="stacked" color="medium">Birthday</ion-label>
            <ion-input class="profile-input" type="date" v-model="userProfile.birthday"></ion-input>
          </ion-item>
          <ion-item lines="none">
            <ion-label position="stacked" color="medium">Email</ion-label>
            <ion-input class="profile-input" type="email" v-model="userProfile.email" required></ion-input>
          </ion-item>
        </template>
        <ion-item lines="none">
          <ion-label position="stacked" color="medium">Zip Code</ion-label>
          <ion-input class="profile-input" type="number" v-model="userProfile.zipCode" maxlength="5"
            required></ion-input>
        </ion-item>
        <!-- Add more fields as needed -->
        <ion-button expand="block" type="submit" :disabled="isLoading">
          <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
          <span v-else>Update Profile</span>
        </ion-button>
      </form>
      <div v-if="errorMessage" class="error-container">
        <ion-icon :icon="alertCircleOutline" color="danger"></ion-icon>
        <p>{{ errorMessage }}</p>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup>
import { ref, watch } from 'vue';
import { IonContent, IonModal, IonItem, IonLabel, IonInput, IonButton, IonSpinner, IonIcon, IonCard } from '@ionic/vue';
import { alertCircleOutline } from 'ionicons/icons';
import CouponsApi from '@/axios/apiCoupons';
import CustomerApi from '@/axios/apiCustomer';
import { TokenStorage } from '@/utils/tokenStorage';

// Props and Events
const props = defineProps({
  isOpen: Boolean
});

defineEmits(['update:isOpen']);

const userProfile = ref({
  firstName: '',
  lastName: '',
  birthday: '',
  email: '',
  zipCode: ''
});

const isLoading = ref(false);
const errorMessage = ref('');
const hasMidaxCoupons = ref(import.meta.env.VITE_HAS_MIDAX_COUPONS === "true");
const midaxProfileData = ref(null);

// Function to format date for input
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  return dateString.replace(/\//g, '-');
};

const fetchUserProfile = async () => {
  try {
    console.log('Starting fetchUserProfile, hasMidaxCoupons:', hasMidaxCoupons.value);
    if (hasMidaxCoupons.value) {
      // First, try to load from localStorage for immediate display
      const cachedUserData = localStorage.getItem('userData');
      if (cachedUserData) {
        try {
          const userData = JSON.parse(cachedUserData);
          console.log('Loading from localStorage:', userData);
          
          // Handle both array and object formats
          const userDataObj = Array.isArray(userData) ? userData[0] : userData;
          
          if (userDataObj) {
            midaxProfileData.value = userDataObj;
            userProfile.value = {
              firstName: userDataObj.FirstName || '',
              lastName: userDataObj.LastName || '',
              zipCode: userDataObj.Zip || ''
            };
            console.log('Profile loaded from localStorage:', userProfile.value);
          }
        } catch (error) {
          console.error('Error parsing cached user data:', error);
        }
      }

      // Try to fetch fresh data in background (optional fallback)
      const storeId = localStorage.getItem('storeId') || '201949';
      if (storeId) {
        try {
          console.log('Fetching fresh data from API, StoreId:', storeId);
          const response = await CustomerApi.checkForExistingUser(storeId);
          console.log('Fresh API Response:', response);

          if (response.data && response.data[0]) {
            console.log('Fresh user data received:', response.data[0]);
            
            // Update localStorage with fresh data
            localStorage.setItem('userData', JSON.stringify(response.data));
            
            // Update the profile with fresh data
            midaxProfileData.value = response.data[0];
            userProfile.value = {
              firstName: response.data[0].FirstName || '',
              lastName: response.data[0].LastName || '',
              zipCode: response.data[0].Zip || ''
            };
            console.log('Profile updated with fresh data:', userProfile.value);
          }
        } catch (apiError) {
          console.warn('API call failed, using cached data:', apiError);
          // If we have cached data, we can continue silently
          // If no cached data was available, this will be handled below
        }
      }
      
      // If we still don't have any profile data, show error
      if (!userProfile.value.firstName && !userProfile.value.lastName) {
        throw new Error('No user data available');
      }
    } else {
      console.log('Using CouponsApi to fetch data');
      const data = await CouponsApi.getCustomerInfo();
      console.log('CouponsApi data:', data);
      if (!data) {
        throw new Error('No customer data found.');
      }

      userProfile.value = {
        firstName: data.FirstName || '',
        lastName: data.LastName || '',
        birthday: formatDateForInput(data.Birthday) || '',
        email: data.Email || '',
        zipCode: data.Zip || ''
      };

      console.log('Mapped user profile:', userProfile.value);
    }
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    errorMessage.value = 'Failed to retrieve customer information.';
  }
};

const submitUserProfile = async () => {
  isLoading.value = true;
  try {
    if (hasMidaxCoupons.value) {
      if (!midaxProfileData.value) {
        throw new Error('No profile data found');
      }

      const updatedProfile = {
        ...midaxProfileData.value,
        FirstName: userProfile.value.firstName,
        LastName: userProfile.value.lastName,
        Zip: userProfile.value.zipCode
      };

      await CustomerApi.updateProfile(updatedProfile);
      midaxProfileData.value = updatedProfile;
    } else {
      const refreshToken = TokenStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token found');
      }
      await CouponsApi.updateUserProfile(userProfile.value, refreshToken);
    }
    alert('Your profile has been updated successfully.');
  } catch (error) {
    console.error('Failed to update profile:', error);
    errorMessage.value = 'Failed to update profile. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

// Watch for modal open to fetch profile
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    fetchUserProfile();
  }
}, { immediate: true });
</script>

<style scoped>
.error-container {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--ion-color-danger-tint);
  padding: 16px;
  border-radius: 12px;
  margin-top: 16px;
}

ion-input.profile-input {
  --color: var(--ion-color-dark);
  --padding-bottom: 10px;
  --padding-top: 10px;
  border-bottom: 1px solid var(--ion-color-light-shade);
  vertical-align: middle;
  margin-bottom: 15px;
  transition: border-bottom 0.3s ease-in-out;
}

ion-item ion-input.profile-input:focus-within {
  border-bottom: 2px solid var(--ion-color-primary);
  /* Change this for focus */
}

ion-item:focus-within ion-label {
  color: var(--ion-color-danger) !important;
  /* Change label color on focus */
  font-weight: bold;
  /* Optional for better focus effect */
  /* transition: color 0.3s ease-in-out; */
}

ion-button {
  margin-top: 32px;
}

.no-notifications-card {
  background: var(--ion-color-light);
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  border-style: solid;
  border-width: 1px;
  border-color: var(--ion-color-light-shade);
  /* box-shadow: 0 2px 4px rgba(0,0,0,0.1); */
}

.no-notifications-label {
  color: var(--ion-color-medium);
  font-size: 14px;
  margin-bottom: 4px;
}

.no-notifications-message {
  color: var(--ion-color-dark);
  font-size: 16px;
  font-weight: 600;
}
</style>