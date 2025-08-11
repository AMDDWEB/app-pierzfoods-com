<template>
  <ion-app>
    <ion-router-outlet />
    
    <!-- Global Error Alert for coupon clipping -->
    <ion-alert
      :is-open="showErrorAlert"
      header="Error"
      :message="errorMessage"
      :buttons="[{ text: 'OK', role: 'cancel', handler: () => closeErrorAlert() }]"
    />
  </ion-app>
</template>

<script setup>
import { IonApp, IonRouterOutlet, IonAlert, isPlatform } from '@ionic/vue'
import { Browser } from '@capacitor/browser'
import { App as CapApp } from '@capacitor/app'
import { AppTrackingTransparency } from 'capacitor-plugin-app-tracking-transparency'
import { watch, onMounted, onUnmounted } from 'vue'
import { useClippedCoupons } from './composables/useClippedCoupons'
import CustomerApi from './axios/apiCustomer'
import { useAuthModule } from './composables/useAuth0Modal'
import { useRouter } from 'vue-router'
import Customer from './axios/apiCustomer'

const router = useRouter()

// Get alert state from the useClippedCoupons composable
const { showErrorAlert, errorMessage, closeErrorAlert } = useClippedCoupons()

const {
  getAccessTokenSilently,
  handleRedirectCallback,
  isAuthenticated
} = useAuthModule()

async function getAccessToken() {
  return await getAccessTokenSilently()
}

watch(isAuthenticated, async (newValue) => {
  if (newValue) {
    const accessToken = await getAccessToken()
    localStorage.setItem('accessToken', accessToken)
    
    const storeId = localStorage.getItem('storeId') || '201949'

    try {
      const response = await Customer.checkForExistingUser(storeId)
      const userDetailsArray = response.data
      
      if (Array.isArray(userDetailsArray) && userDetailsArray.length > 0) {
        const userDetails = userDetailsArray[0]
        // Handle both CardNumber and cardNumber formats
        const cardNumberValue = userDetails.CardNumber || userDetails.cardNumber;
        if (cardNumberValue) {
          localStorage.setItem('CardNumber', cardNumberValue)
        }
        if (userDetails.FirstName) {
          localStorage.setItem('firstName', userDetails.FirstName)
        }
        
        window.dispatchEvent(new CustomEvent('userSignedUp', {
          detail: {
            loyaltyNumber: userDetails.PhoneNumber || '',
            cardNumber: userDetails.CardNumber || userDetails.cardNumber || ''
          }
        }))
      }
    } catch (error) {
      console.error('Error checking user details:', error)
    }
  }
})

async function checkForExistingUser() {
  const accessToken = await getAccessToken()
  const storeId = localStorage.getItem('storeId') || '201949'

  // Validate store ID length and format
  if (!storeId || storeId.length > 6 || isNaN(storeId)) {
    console.error('Invalid or missing store ID:', storeId)
    return
  }

  try {
    const response = await CustomerApi.checkForExistingUser(
      storeId,
      import.meta.env.VITE_APP_ID
    )

    if (response.data) {
      localStorage.setItem('userData', JSON.stringify(response.data))

      if (import.meta.env.VITE_HAS_MIDAX_COUPONS === "true") {
        const cardNumberValue = response.data.CardNumber || response.data.cardNumber || response.data.card_number

        if (cardNumberValue) {
          localStorage.setItem('CardNumber', cardNumberValue)

          window.dispatchEvent(new CustomEvent('userSignedUp', {
            detail: {
              loyaltyNumber: response.data.phone_number || '',
              cardNumber: cardNumberValue
            }
          }))
        }
      }
    }
  } catch (error) {
    console.error('Error checking for existing user:', error)
  }
}

// Initialize App Tracking Transparency
async function initAppTracking() {
  try {
    const status = await AppTrackingTransparency.getStatus()
    
    if (status.status === 'notDetermined') {
      await AppTrackingTransparency.requestPermission()
    }
  } catch (error) {
    console.error('Error requesting tracking permission:', error)
  }
}

// Call the initialization function
if (isPlatform('ios')) {
  initAppTracking()
}

CapApp.addListener('appUrlOpen', async ({ url }) => {
  console.log('URL opened:', url)
  if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
    await handleRedirectCallback(url)
  }
  
  await Browser.close()
  
  if (isAuthenticated.value) {
    checkForExistingUser()
  }
})
</script>
