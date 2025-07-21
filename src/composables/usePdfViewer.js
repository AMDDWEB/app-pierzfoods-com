import { ref, onUnmounted } from 'vue'
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
const { Http } = Capacitor;

const pdfjsLib = window.pdfjsLib

const fetchPdfAsBlob = async (url) => {
  try {
    const response = await Http.get({
      url,
      responseType: 'blob'
    });

    const byteCharacters = atob(response.data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    const blobUrl = URL.createObjectURL(blob);
    return { blob, blobUrl };
  } catch (error) {
    throw error;
  }
};

const usePdfViewer = () => {
  const pdfDoc = ref(null);
  const currentPage = ref(1);
  const totalPages = ref(0);
  const loading = ref(false);
  const error = ref(null);
  const currentBlobUrl = ref(null);

  const cleanupBlobUrl = () => {
    if (currentBlobUrl.value) {
      URL.revokeObjectURL(currentBlobUrl.value);
      currentBlobUrl.value = null;
    }
  };

  const initPdfViewer = () => {
    if (!window.pdfjsLib) {
      error.value = 'PDF.js library not initialized';
      return false;
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    return true;
  };

  const loadPdf = async (url, container) => {
    loading.value = true;
    error.value = null;

    try {
      if (!window.pdfjsLib) {
        throw new Error('PDF.js library not initialized');
      }

      container.innerHTML = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        color: var(--ion-color-medium);
      `;
      loadingDiv.innerHTML = `
        <ion-spinner></ion-spinner>
        <div>Loading ad...</div>
      `;
      container.appendChild(loadingDiv);

      let pdfBlob, blobUrl;

      if (Capacitor.isNativePlatform()) {
        try {
          const fileName = `pdf_${Date.now()}.pdf`;

          await Filesystem.downloadFile({
            url: url,
            path: fileName,
            directory: Directory.Cache
          });

          const fileContent = await Filesystem.readFile({
            path: fileName,
            directory: Directory.Cache
          });

          const byteCharacters = atob(fileContent.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
          blobUrl = URL.createObjectURL(pdfBlob);

          await Filesystem.deleteFile({
            path: fileName,
            directory: Directory.Cache
          });

        } catch (nativeError) {
          const result = await fetchPdfAsBlob(url);
          pdfBlob = result.blob;
          blobUrl = result.blobUrl;
        }
      } else {
        const result = await fetchPdfAsBlob(url);
        pdfBlob = result.blob;
        blobUrl = result.blobUrl;
      }

      cleanupBlobUrl();
      currentBlobUrl.value = blobUrl;

      const loadingTask = pdfjsLib.getDocument({
        url: blobUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/cmaps/',
        cMapPacked: true,
      });

      pdfDoc.value = await loadingTask.promise;
      totalPages.value = pdfDoc.value.numPages;
      currentPage.value = 1;

      container.innerHTML = '';
      await renderPage(currentPage.value, container);

    } catch (err) {
      error.value = err.message;
      container.innerHTML = `
        <div style="text-align: center; color: var(--ion-color-danger);">
          <p>Error loading PDF: ${err.message}</p>
        </div>
      `;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  onUnmounted(() => {
    cleanupBlobUrl();
  });

  const renderPage = async (pageNumber, container) => {
    try {
      if (!container.clientWidth) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const page = await pdfDoc.value.getPage(pageNumber);
      container.innerHTML = '';

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale: 2.0 });
      const scale = container.clientWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale: Math.max(scale, 2.0) });

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;

      container.appendChild(canvas);

    } catch (err) {
      // Handle error silently
    }
  };

  const nextPage = async (container) => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
      await renderPage(currentPage.value, container)
    }
  }

  const previousPage = async (container) => {
    if (currentPage.value > 1) {
      currentPage.value--
      await renderPage(currentPage.value, container)
    }
  }

  return {
    currentPage,
    totalPages,
    loading,
    error,
    initPdfViewer,
    loadPdf,
    nextPage,
    previousPage,
  }
};

export default usePdfViewer;
