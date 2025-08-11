<template>
  <ion-modal :is-open="isOpen" @didDismiss="closeModal" :swipe-to-close="true" :backdropDismiss="true">
    <ion-header>
      <ion-toolbar>
        <ion-title>Select My Store</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <div class="app-search-container">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="app-custom-search-icon">
            <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM288 176c0-44.2-35.8-80-80-80s-80 35.8-80 80c0 48.8 46.5 111.6 68.6 138.6c6 7.3 16.8 7.3 22.7 0c22.1-27 68.6-89.8 68.6-138.6zm-112 0a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/>
          </svg>
          <input
            v-model="searchQuery"
            placeholder="Search locations..."
            @input="handleSearch"
            class="app-search-input"
          />
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="location in filteredLocations" :key="location.id">
          <ion-icon name="location-dot" color="primary" slot="start"></ion-icon>
          <ion-label>
            <h2>{{ location.title }}</h2>
            <p class="app-text-overflow">{{ location.address?.address }}</p>
          </ion-label>
          <ion-toggle slot="end" :checked="isLocationSelected(location)"
            @ionChange="() => toggleLocation(location)"></ion-toggle>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonToggle, IonButtons, IonButton } from '@ionic/vue';
import apiLocations from '../axios/apiLocations';

const hasMidaxCoupons = import.meta.env.VITE_HAS_MIDAX_COUPONS === 'true';
const props = defineProps({
  isOpen: Boolean,
  currentLocation: Object
});

const emit = defineEmits(['update:is-open', 'location-selected']);

const locations = ref([]);
const selectedLocation = ref(null);
const searchQuery = ref('');

// Initialize on mount
onMounted(async () => {
  await fetchLocations();
  await initializeSelectedLocation();
  
  // Removed automatic modal opening to improve user experience
  // Location selection will now be fully user-initiated
});

// Watch for modal opening
watch(() => props.isOpen, async (newIsOpen) => {
  if (newIsOpen) {
    await fetchLocations();
    await initializeSelectedLocation();
  }
});

// Watch for current location changes
watch(() => props.currentLocation, async (newLocation) => {
  if (newLocation) {
    selectedLocation.value = newLocation;
  } else {
    await initializeSelectedLocation();
  }
}, { deep: true });

async function initializeSelectedLocation() {
  // First check props
  if (props.currentLocation) {
    selectedLocation.value = props.currentLocation;
  } else {
    // Then check localStorage
    const storedLocation = localStorage.getItem('selectedLocation');
    if (storedLocation) {
      const parsedLocation = JSON.parse(storedLocation);
      // Verify the location still exists in our list
      const locationExists = locations.value.some(loc => loc.id === parsedLocation.id);
      if (locationExists) {
        selectedLocation.value = parsedLocation;
      }
    }
  }
}

async function fetchLocations() {
  try {
    const response = await apiLocations.getLocations();
    locations.value = response;
  } catch (error) {
    locations.value = [];
  }
}

function isLocationSelected(location) {
  return selectedLocation.value?.id === location.id;
}

async function toggleLocation(location) {
  if (!location) return;
  
  try {
    // Get fresh location data before storing
    const freshLocation = await apiLocations.getLocationById(location.id);
    if (freshLocation) {
      // Update both the selected location and localStorage with fresh data
      selectedLocation.value = freshLocation;
      localStorage.setItem('selectedLocation', JSON.stringify(freshLocation));
      // Store the store ID for coupons only if coupon_availability is true
      if (freshLocation.coupon_availability === true) {
        localStorage.setItem('storeId', freshLocation.coupon_id || null);
      } else {
        localStorage.removeItem('storeId');
      }
      
      // Emit events with fresh location data
      emit('location-selected', freshLocation);
      window.dispatchEvent(new CustomEvent('locationChanged', {
        detail: freshLocation
      }));
    } else {
      // Fallback to original location if fresh data fetch fails
      selectedLocation.value = location;
      localStorage.setItem('selectedLocation', JSON.stringify(location));
      // Only set storeId if coupon_availability is true
      if (location.coupon_availability === true) {
        localStorage.setItem('storeId', location.coupon_id || null);
      } else {
        localStorage.removeItem('storeId');
      }
      emit('location-selected', location);
      window.dispatchEvent(new CustomEvent('locationChanged', {
        detail: location
      }));
    }
  } catch (error) {
    // Fallback to original location if API call fails
    selectedLocation.value = location;
    localStorage.setItem('selectedLocation', JSON.stringify(location));
    // Only set storeId if coupon_availability is true
    if (location.coupon_availability === true) {
      localStorage.setItem('storeId', location.coupon_id || null);
    } else {
      localStorage.removeItem('storeId');
    }
    emit('location-selected', location);
    window.dispatchEvent(new CustomEvent('locationChanged', {
      detail: location
    }));
  }
  
  // Small delay to ensure events are processed before closing
  setTimeout(() => {
    closeModal();
  }, 100);
}

function closeModal() {
  // Ensure one final check of selected location before closing
  const storedLocation = localStorage.getItem('selectedLocation');
  if (storedLocation) {
    const parsedLocation = JSON.parse(storedLocation);
    selectedLocation.value = parsedLocation;
    // Ensure storeId is set
    localStorage.setItem('storeId', parsedLocation.coupon_id || null);
  }
  
  emit('update:is-open', false);
}

const filteredLocations = computed(() => {
  if (!searchQuery.value) return locations.value;
  const query = searchQuery.value.toLowerCase();
  return locations.value.filter(location => 
    location.title?.toLowerCase().includes(query) ||
    location.address?.address?.toLowerCase().includes(query)
  );
});

const handleSearch = () => {
  // The filtering is handled by the computed property
};
</script>

<style scoped>
.app-text-overflow {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

.app-search-input::placeholder {
  color: var(--ion-color-medium);
}
</style>