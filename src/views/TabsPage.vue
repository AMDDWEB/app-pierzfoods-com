<template>
  <ion-page>
    <ion-tabs>
  <ion-router-outlet cache="false"></ion-router-outlet>
  <ion-tab-bar slot="bottom" id="mainTabBar">
    <ion-tab-button tab="home" href="/tabs/home">
      <ion-icon name="home-regular"/>
      <ion-label>Home</ion-label>
    </ion-tab-button>
    <ion-tab-button tab="locations" href="/tabs/locations">
      <ion-icon name="locations-regular" />
      <ion-label>Locations</ion-label>
    </ion-tab-button>
    <ion-tab-button tab="coupons" href="/tabs/coupons">
      <ion-icon name="barcode-coupon-regular" />
      <ion-label>Coupons</ion-label>
    </ion-tab-button>
    <ion-tab-button tab="recipes" href="/tabs/recipes">
      <ion-icon name="recipes-regular" />
      <ion-label>Recipes</ion-label>
    </ion-tab-button>
    <ion-tab-button tab="preferences" href="/tabs/preferences">
      <ion-icon name="more-regular" />
      <ion-label>More</ion-label>
    </ion-tab-button>
  </ion-tab-bar>
</ion-tabs>
  </ion-page>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { useCouponDetails } from '@/composables/useCouponDetails';
import { TokenStorage } from '@/utils/tokenStorage';

export default {
  components: {
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonLabel,
    IonIcon,
    IonPage,
    IonRouterOutlet
  },
  setup() {
    const { coupons, loading, fetchCoupons } = useCouponDetails();
    const hasAppCardCoupons = ref(import.meta.env.VITE_HAS_APPCARD_COUPONS === "true");
    const hasMidaxCoupons = ref(import.meta.env.VITE_HAS_MIDAX_COUPONS === "true");
    const storeId = ref(localStorage.getItem('storeId'));
    const selectedLocation = ref(JSON.parse(localStorage.getItem('selectedLocation') || '{}'));
    
    const hasStoreId = computed(() => {
      return !!storeId.value && selectedLocation.value?.coupon_availability === true;
    });

    // Dynamic coupon availability
    const hasCoupons = computed(() => coupons.value.length > 0);
    
    // Force update function to ensure state is in sync
    const forceUpdateState = () => {
      storeId.value = localStorage.getItem('storeId');
      selectedLocation.value = JSON.parse(localStorage.getItem('selectedLocation') || '{}');
    };

    // Watch for location changes
    watch(() => localStorage.getItem('selectedLocation'), async (newLocation) => {
      if (newLocation) {
        forceUpdateState(); // Ensure all state is in sync
        if (selectedLocation.value?.coupon_availability === true) {
          await fetchCoupons({ limit: 10, offset: 0 });
        } else {
          coupons.value = [];
        }
      }
    }, { immediate: true }); // Add immediate: true to trigger on initial load

    // Watch for authentication changes
    watch(() => TokenStorage.hasTokens(), async (isAuthenticated) => {
      if (isAuthenticated) {
        await fetchCoupons({ limit: 10, offset: 0 });
      }
    });

    // Create a handler function that we can reference for both adding and removing event listener
    const handleLocationChanged = async (event) => {
      forceUpdateState(); // Ensure all state is in sync
      
      if (selectedLocation.value?.coupon_availability === true) {
        await fetchCoupons({ limit: 10, offset: 0 });
      } else {
        // Clear coupons if coupon_availability is false
        coupons.value = [];
      }
    };

    onMounted(async () => {
      // Initial coupon fetch
      const selectedLocation = JSON.parse(localStorage.getItem('selectedLocation') || '{}');
      
      if (hasMidaxCoupons.value) {
        if (selectedLocation && selectedLocation.coupon_availability === true) {
          storeId.value = localStorage.getItem('storeId');
          await fetchCoupons({ limit: 10, offset: 0 });
        } else {
          // Clear coupons if no location or coupon_availability is false
          coupons.value = [];
        }
      } else if (import.meta.env.VITE_HAS_APPCARD_COUPONS === "true") {
        // For AppCard, only fetch if we have a selected location with coupon_availability true
        if (selectedLocation?.coupon_availability === true) {
          await fetchCoupons({ limit: 10, offset: 0 });
        } else {
          // Clear coupons if no location or coupon_availability is false
          coupons.value = [];
        }
      }

      // Listen for location change events
      window.addEventListener('locationChanged', handleLocationChanged);

      // Additional direct check for storeId changes
      window.addEventListener('storage', (event) => {
        if (event.key === 'storeId' || event.key === 'selectedLocation') {
          storeId.value = localStorage.getItem('storeId');
        }
      });
    });

    // Clean up event listeners when component is unmounted
    onUnmounted(() => {
      window.removeEventListener('locationChanged', handleLocationChanged);
      window.removeEventListener('storage', handleLocationChanged);
    });

    return {
      hasAppCardCoupons,
      hasMidaxCoupons,
      hasStoreId,
      hasCoupons
    };
  }
};
</script>

<style lang="css" scoped>
ion-tab-button ion-icon {
  padding: 4px; /* Adjust as needed */
}
</style>