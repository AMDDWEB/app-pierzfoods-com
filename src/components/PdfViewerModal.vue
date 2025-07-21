<template>
  <ion-modal 
  :breakpoints="[1]" 
  :is-open="isOpen"
  @didDismiss="closeModal"
  :swipe-to-close="false"
 :backdropDismiss="false">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ adType }} for {{ formattedStartDate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="closeModal">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <div class="pdf-controls">
          <ion-button shape="round" size="small" :disabled="currentPage === 1"
            @click="handlePreviousPage">
            <ion-icon :icon="chevronBackOutline"></ion-icon>
          </ion-button>

          <div class="pdf-pagination">
            Page {{ currentPage }} of {{ totalPages }}
          </div>

          <ion-button shape="round" size="small" :disabled="currentPage === totalPages"
            @click="handleNextPage">
            <ion-icon :icon="chevronForwardOutline"></ion-icon>
          </ion-button>
        </div>

      </ion-toolbar>
    </ion-header>
    <ion-content>

      <div ref="pdfContainer" class="pdf-container"></div>
    </ion-content>
  </ion-modal>
</template>

<script setup>
import { ref, nextTick, watch, onMounted, computed } from 'vue';
import usePdfViewer from '../composables/usePdfViewer';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';

const props = defineProps({
  isOpen: Boolean,
  pdfUrl: String,
  adType: {
    type: String,
    default: 'Ad'
  },
  startDate: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:isOpen']);
// const presentingElement = ref(document.querySelector('ion-router-outlet'));

const pdfContainer = ref(null);

const {
  currentPage,
  totalPages,
  loadPdf,
  initPdfViewer,
  nextPage,
  previousPage
} = usePdfViewer();

// // Update the date formatting to MM/DD format
// const formattedStartDate = computed(() => {
//   if (!props.startDate) return '';
//   const date = new Date(props.startDate);
//   return `${date.getMonth() + 1}/${date.getDate()}`; // This will show format like "1/1" or "12/31"
// });

// Computed property for formatted start date
const formattedStartDate = computed(() => {
  if (!props.startDate) return ''; // Avoid errors if startDate is empty

  const startDate = new Date(props.startDate);
  if (isNaN(startDate)) return ''; // Handle invalid dates

  // Format month name (e.g., "Feb")
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(startDate);

  // Get the day and add ordinal suffix (st, nd, rd, th)
  const day = startDate.getDate();
  const dayWithSuffix = addOrdinalSuffix(day);

  return `${month} ${dayWithSuffix}`;
});

// Function to add ordinal suffix
const addOrdinalSuffix = (day) => {
  if (day >= 11 && day <= 13) return `${day}th`; // Special case for 11-13
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
};

const closeModal = () => {
  emit('update:isOpen', false);
};

const handleNextPage = async () => {
  if (pdfContainer.value) {
    await nextPage(pdfContainer.value);
  }
};

const handlePreviousPage = async () => {
  if (pdfContainer.value) {
    await previousPage(pdfContainer.value);
  }
};

watch(() => props.isOpen, async (newVal) => {
  if (newVal && props.pdfUrl) {
    await nextTick();
    if (pdfContainer.value) {
      await loadPdf(props.pdfUrl, pdfContainer.value);
    }
  }
});

onMounted(() => {
  initPdfViewer();
});

const scale = ref(1);
const MIN_SCALE = 1;
const MAX_SCALE = 3;
let isPanning = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Handle Pinch Zoom
const handlePinchZoom = (event) => {
  if (event.scale) {
    const ZOOM_SPEED = 0.1; // Adjust speed (higher = slower, lower = faster)
    let newScale = scale.value + (event.scale - 1) * ZOOM_SPEED;
    if (newScale < MIN_SCALE) newScale = MIN_SCALE;
    if (newScale > MAX_SCALE) newScale = MAX_SCALE;

    scale.value = newScale;

    if (pdfContainer.value) {
      // Get touch position relative to the container
      const rect = pdfContainer.value.getBoundingClientRect();
      const focusX = ((event.touches ? event.touches[0].clientX : event.clientX) - rect.left) / rect.width * 100;
      const focusY = ((event.touches ? event.touches[0].clientY : event.clientY) - rect.top) / rect.height * 100;

      // Apply the new scale and set transform-origin based on user focus
      pdfContainer.value.style.transform = `scale(${scale.value})`;
      pdfContainer.value.style.transformOrigin = `${focusX}% ${focusY}%`;
    }
  }
};

// Enable touch scrolling and panning logic
const enableTouchScrolling = () => {
  if (pdfContainer.value) {
    pdfContainer.value.style.touchAction = scale.value > 1 ? 'none' : 'auto';
    pdfContainer.value.style.overflow = scale.value > 1 ? 'hidden' : 'auto';
  }
};

// Handle Panning
const startPan = (event) => {
  if (scale.value > 1) {
    isPanning = true;
    startX = event.touches ? event.touches[0].clientX : event.clientX;
    startY = event.touches ? event.touches[0].clientY : event.clientY;
  }
};

const PAN_SPEED = 0.5; // Adjust speed (lower = slower, higher = faster)

const panMove = (event) => {
  if (isPanning && pdfContainer.value) {
    let deltaX = (event.touches ? event.touches[0].clientX : event.clientX) - startX;
    let deltaY = (event.touches ? event.touches[0].clientY : event.clientY) - startY;

    // Apply PAN_SPEED multiplier
    currentX += deltaX * PAN_SPEED;
    currentY += deltaY * PAN_SPEED;

    startX = event.touches ? event.touches[0].clientX : event.clientX;
    startY = event.touches ? event.touches[0].clientY : event.clientY;

    pdfContainer.value.style.transform = `scale(${scale.value}) translate(${currentX}px, ${currentY}px)`;
  }
};

const endPan = () => {
  isPanning = false;
};

onMounted(() => {
  pdfContainer.value.addEventListener('gesturechange', throttledPinchZoom);
  pdfContainer.value.addEventListener('gesturestart', enableTouchScrolling);
  pdfContainer.value.addEventListener('touchstart', startPan);
  pdfContainer.value.addEventListener('touchmove', throttledPanMove);
  pdfContainer.value.addEventListener('touchend', endPan);
});

let isGestureActive = false;

const throttledPinchZoom = (event) => {
  if (!isGestureActive) {
    isGestureActive = true;
    requestAnimationFrame(() => {
      handlePinchZoom(event);
      isGestureActive = false;
    });
  }
};

const throttledPanMove = (event) => {
  if (!isGestureActive) {
    isGestureActive = true;
    requestAnimationFrame(() => {
      panMove(event);
      isGestureActive = false;
    });
  }
};
</script>

<style scoped>
.pdf-controls {
  /* padding: 20px 8px 20px; */
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pdf-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    touch-action: auto; 
    position: relative;
    cursor: grab;
    will-change: transform;
    transform: translateZ(0);
}
.pdf-container:active {
    cursor: grabbing;
}

.pdf-container img,
.pdf-container canvas {
  transform-origin: center;
  transition: transform 0.5s ease-out;
}

.pdf-pagination {
  flex: 1;
  text-align: center;
  font-size: 16px;
  color: var(--ion-color-medium);
}
</style>