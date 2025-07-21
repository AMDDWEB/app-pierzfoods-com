<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="$router.go(-1)">
            <ion-icon slot="icon-only" color="primary" name="back-button" size="small"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title v-if="locationData">{{ locationData.name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="shareLocation">
            <ion-icon slot="icon-only" color="primary" name="share" size="small"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="loading" class="app-loading-container">
        <ion-spinner name="crescent" class="app-loading-spinner"></ion-spinner>
      </div>

      <div v-else-if="locationData">
        <ion-item lines="none" class="ion-margin-top">
          <ion-label>
            <h1 class="location-heading">{{ locationData.name }}</h1>
            <h2 class="location-subheading">{{ locationData.location_banner[0]?.banner_name }}</h2>
          </ion-label>
        </ion-item>

        <ion-item lines="none">
          <ion-label>
            <p class="" style="color: var(--ion-color-dark);">
              {{ locationData.street_number }} {{ locationData.street_name }}<br>
              {{ locationData.city }}, {{ locationData.state_short }} {{ locationData.post_code }}
            </p>
          </ion-label>
        </ion-item>


        <!-- Get Directions, Call Store, and Set as My Store buttons -->
        <ion-grid :fixed="true" class="ion-margin-top">
          <ion-row>
            <!-- <ion-col>
              <ion-button expand="block" size="small" @click="gotoStore">
                <ion-icon slot="start" name="get-directions-regular"></ion-icon>
                Directions
              </ion-button>
            </ion-col>
            <ion-col>
              <ion-button expand="block" size="small" @click="callStore">
                <ion-icon slot="start" name="call-store-regular"></ion-icon>
                Call Store
              </ion-button> -->
              <ion-col v-if="hasWeeklyAd">
              <ion-button expand="block" size="small" @click="openWeeklyAd">
                <ion-icon slot="start" name="ads-regular"></ion-icon>
                Weekly Ad
              </ion-button>
            </ion-col>
            <ion-col>
              <ion-button expand="block" size="small" @click="setAsMyStore"
                :color="isSelectedLocation ? 'primary' : 'medium'">
                <ion-icon slot="start" name="set-location-regular"></ion-icon>
                {{ isSelectedLocation ? 'My Store' : 'Set as Store' }}
              </ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>

        <!-- Store Hours List -->
        <ion-list v-if="storeHours.length">
          <ion-list-header>
            <ion-label>
              Store Hours
              <ion-badge class="location-badge" :color="getLocationStatus(locationData).color">
                {{ getLocationStatus(locationData).text }}
              </ion-badge>
            </ion-label>
          </ion-list-header>
          <ion-item v-for="hour in storeHours" :key="hour.day" :class="{ 'current-day': isCurrentDay(hour.day) }">
            <ion-label>
              <span class="location-day">{{ hour.day }}</span>
              <span class="location-hours" :class="{ 'current-day-hours': isCurrentDay(hour.day) }">
                {{ hour.opening }} to {{ hour.closing }}
              </span>
            </ion-label>
          </ion-item>
        </ion-list>
        <p v-else>No store hours available</p>

        <!-- Weekly Ads and Rewards -->
        <ion-grid :fixed="true" class="ion-margin-top-large">
          <ion-row>
            <!-- <ion-col v-if="hasWeeklyAd">
              <ion-button expand="block" size="small" @click="openWeeklyAd">
                <ion-icon slot="start" name="ads-regular"></ion-icon>
                Weekly Ad
              </ion-button>
            </ion-col> -->
            <ion-col>
            <ion-button expand="block" size="small" @click="gotoStore">
                <ion-icon slot="start" name="get-directions-regular"></ion-icon>
                Directions
              </ion-button>
            </ion-col>
            <ion-col>
              <ion-button expand="block" size="small" @click="callStore">
                <ion-icon slot="start" name="call-store-regular"></ion-icon>
                Call Store
              </ion-button>
            </ion-col>
            <!-- <ion-col v-if="hasRewards">
              <ion-button expand="block" size="small" @click="openRewardsURL">
                <ion-icon slot="start" name="rewards-regular"></ion-icon>
                Rewards
              </ion-button>
            </ion-col>
            <ion-col v-if="hasSale">
              <ion-button expand="block" size="small" @click="openSale">
                <ion-icon slot="start" name="sales-regular"></ion-icon>
                Sale
              </ion-button> 
            </ion-col>-->
          </ion-row>
        </ion-grid>
      </div>
    </ion-content>

    <!-- Single PDF Modal -->
    <PdfViewerModal :is-open="pdfModalState.isOpen" :pdf-url="pdfModalState.url" :ad-type="pdfModalState.type"
      :start-date="pdfModalState.startDate" @update:is-open="closePdfModal" />
  </ion-page>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiLocations from '../axios/apiLocations';
import { Share } from '@capacitor/share';
import { useDateFormat } from '../composables/useDateFormat';
import { IonPage, IonHeader, IonToolbar, IonContent, IonList, IonItem, IonLabel, IonBadge, IonIcon, IonAlert, IonSpinner, IonRefresher, IonRefresherContent, IonButton, IonButtons, IonTitle, IonGrid, IonRow, IonCol } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { alertController } from '@ionic/vue';
import PdfViewerModal from '../components/PdfViewerModal.vue';
import { useLocationDetails } from '@/composables/useLocationDetails';

const route = useRoute();
const router = useRouter();
const props = defineProps(['id']);

const locationData = ref(null);
const loading = ref(true);
const storeHours = ref([]);
const { formatTime } = useDateFormat();
const { transformLocationData } = useLocationDetails();

const getLocationStatus = (location) => {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const dayIndex = storeHours.value.findIndex(
    hour => hour.day.toLowerCase() === currentDay.toLowerCase()
  );

  if (dayIndex === -1) {
    return { text: 'Closed', color: 'danger' };
  }

  const todayHours = storeHours.value[dayIndex];
  if (!todayHours.opening || !todayHours.closing) {
    return { text: 'Hours N/A', color: 'warning' };
  }

  const openTime = convertTo24HourFormat(todayHours.opening);
  const closeTime = convertTo24HourFormat(todayHours.closing);
  const currentTime24 = convertTo24HourFormat(currentTime);

  if (currentTime24 >= openTime && currentTime24 < closeTime) {
    return { text: 'Now Open', color: 'success' };
  } else {
    return { text: 'Closed', color: 'danger' };
  }
};

const convertTo24HourFormat = (time) => {
  if (time.match(/^\d{2}:\d{2}$/)) {
    return time;
  }

  const [timePart, modifier] = time.split(' ');
  if (!timePart || !modifier) {
    return '00:00';
  }

  let [hours, minutes] = timePart.split(':');
  if (hours === undefined || minutes === undefined) {
    return '00:00';
  }

  hours = String(hours);
  minutes = String(minutes);

  if (modifier === 'PM' && hours !== '12') {
    hours = String(parseInt(hours, 10) + 12);
  } else if (modifier === 'AM' && hours === '12') {
    hours = '00';
  }

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

const loadLocationData = async () => {
  const id = route.params.id || props.id;
  if (id) {
    try {
      loading.value = true;
      const data = await apiLocations.getLocationById(id);
      locationData.value = transformLocationData(data);

      if (locationData.value.hours) {
        storeHours.value = locationData.value.hours;
      }
    } catch (error) {
      // Error handling without logging
    } finally {
      loading.value = false;
    }
  }
};

onMounted(() => {
  loadLocationData();
  checkIfSelectedLocation();
});

watch(() => route.params.id, (newId) => {
  if (newId) {
    loadLocationData();
  }
});

watch(() => locationData.value, () => {
  checkIfSelectedLocation();
});

const shareLocation = async () => {
  const siteUrl = import.meta.env.VITE_SITE_URL;
  const storeName = import.meta.env.VITE_STORE_NAME;

  if (locationData.value) {
    const fullUrl = `${siteUrl}/location/${locationData.value.id}/`;
    await Share.share({
      title: locationData.value.name || `Visit your nearest ${storeName} location.`,
      text: `Visit your nearest ${storeName} location at ${locationData.value.address}`,
      url: fullUrl,
    });
  }
};

const callStore = () => {
  const phoneNumber = locationData.value?.phone_number;
  if (phoneNumber) {
    window.location.href = `tel:${phoneNumber}`;
  }
};

const gotoStore = () => {
  if (locationData.value) {
    const address = locationData.value.address;
    if (address) {
      const encodedLocation = encodeURIComponent(address);
      let url;

      if (Capacitor.getPlatform() === 'ios') {
        url = `https://maps.apple.com/?daddr=${encodedLocation}`;
      } else {
        url = `https://www.google.com/maps/dir/?destination=${encodedLocation}`;
      }

      window.open(url, '_system');
    }
  }
};

const isCurrentDay = (day) => {
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return day.toLowerCase() === currentDay.toLowerCase();
};

const isSelectedLocation = ref(false);

const checkIfSelectedLocation = () => {
  const storedLocation = localStorage.getItem('selectedLocation');
  if (storedLocation && locationData.value) {
    const parsed = JSON.parse(storedLocation);
    isSelectedLocation.value = Number(parsed.id) === Number(locationData.value.id);
  }
};

const isPrimaryLocation = computed(() => {
  const storedLocation = JSON.parse(localStorage.getItem('selectedLocation') || '{}');
  return storedLocation.id === parseInt(props.id);
});

const setAsMyStore = async () => {
  if (locationData.value) {
    if (isSelectedLocation.value) {
      const alert = await alertController.create({
        header: 'My Store',
        message: `${locationData.value.name} is already set as your primary store. To change your main location, please click the preferences button below.`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary'
          },
          {
            text: 'Preferences',
            handler: () => {
              router.push('/tabs/preferences');
            }
          }
        ]
      });

      await alert.present();
    } else {
      const alert = await alertController.create({
        header: 'Confirm Store Selection',
        message: `Are you sure you want to set the ${locationData.value.name} location as your primary store?`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary'
          },
          {
            text: 'OK',
            handler: () => {
              loading.value = true;

              localStorage.setItem('selectedLocation', JSON.stringify(locationData.value));
              isSelectedLocation.value = true;
              isPrimaryLocation.value = true;

              window.dispatchEvent(new CustomEvent('locationChanged', {
                detail: locationData.value
              }));

              setTimeout(() => {
                location.reload();
              }, 1000);
            }
          }
        ]
      });

      await alert.present();
    }
  }
};

const showPreferencesAlert = async () => {
  const alert = await alertController.create({
    header: 'My Store',
    message: 'To set a new preferred store location, please visit the preferences page.',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Preferences',
        handler: () => {
          router.push('/tabs/preferences');
        }
      }
    ]
  });

  await alert.present();
};

const hasWeeklyAd = computed(() => !!locationData.value?.weekly_ad_url);
const hasRewards = computed(() => !!locationData.value?.rewards_url);
const hasWeeklyAdOrRewards = computed(() => hasWeeklyAd.value || hasRewards.value);
const hasSale = computed(() => !!locationData.value?.sale_url);

// Replace individual modal refs with a single state object
const pdfModalState = ref({
  isOpen: false,
  url: '',
  type: '',
  startDate: ''
});

// Replace individual open functions with a single function
const openPdfModal = (type) => {
  if (!locationData.value) return;

  let modalData = {
    isOpen: true,
    url: '',
    type: '',
    startDate: ''
  };

  switch (type) {
    case 'weekly':
      modalData.url = locationData.value.weekly_ad_url;
      modalData.type = locationData.value.weekly_ad_type;
      modalData.startDate = locationData.value.weekly_ad_start_date;
      break;
    case 'rewards':
      modalData.url = locationData.value.rewards_url;
      modalData.type = locationData.value.rewards_type;
      modalData.startDate = locationData.value.rewards_start_date;
      break;
    case 'sale':
      modalData.url = locationData.value.sale_url;
      modalData.type = locationData.value.sale_type;
      modalData.startDate = locationData.value.sale_start_date;
      break;
  }

  pdfModalState.value = modalData;
};

const closePdfModal = (isOpen) => {
  if (!isOpen) {
    pdfModalState.value = {
      isOpen: false,
      url: '',
      type: '',
      startDate: ''
    };
  }
};

// Update the click handlers
const openWeeklyAd = () => openPdfModal('weekly');
const openRewardsURL = () => openPdfModal('rewards');
const openSale = () => openPdfModal('sale');

// Remove the old modal state refs
// Remove: isWeeklyAdModalOpen, isRewardsModalOpen, isSaleModalOpen
</script>

<style scoped>
.app-width-2-3 {
  max-width: 67%;
}

.ion-margin-top-large {
  margin-top: 24px !important;
}

.location-day {
  font-weight: 600;
}

.location-hours {
  float: right;
}

.toolbar-icon {
  font-size: 20px !important;
}

.button-column {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  vertical-align: top !important;
}

.location-badge {
  font-size: 14px;
  color: var(--ion-color-light);
  display: flex;
  float: right;
  margin-right: 20px;
  padding-top: 4px;
  padding-bottom: 4px;
}

.current-day {
  position: relative;
}

.current-day::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--ion-color-primary);
  opacity: 0.1;
  pointer-events: none;
}

.current-day .location-day,
.current-day-hours {
  color: var(--ion-color-danger);
}

.location-hours {
  float: right;
}

ion-grid {
  --ion-grid-columns: 3 !important;
  --ion-grid-column-padding: 1px;
}

ion-button {
  --padding-start: 5px;
  --padding-end: 5px;
  font-size: 14px;
  /* --border-radius: 10px !important; */
}

ion-button ion-icon {
  font-size: 16px;
}

.set-my-store-grid {
  --ion-grid-column-padding: 1px;
}

.set-my-store-grid ion-button {
  --padding-start: 5px;
  --padding-end: 5px;
  font-size: 12px;
}

.set-my-store-grid ion-button ion-icon {
  font-size: 16px;
}

.button-container {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
  margin-top: 20px;
}

.button-container ion-button {
  flex: 1;
  margin: 0 5px;
}

.location-heading {
  font-weight: 800;
}

.location-subheading {
  font-weight: 600;
  color: var(--ion-color-primary);
}
</style>
