// POD App - Progressive Web Application for Delivery Proof Capture
class PODApp {
    constructor() {
        this.currentAWB = '';
        this.capturedMedia = null;
        this.mediaType = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Backend API configuration
        this.config = {
            apiEndpoint: 'http://localhost:3000/api'
        };
        
        this.init();
    }
    
    initializeNewDelivery() {
        // Reset all media-related state
        if (this.capturedMedia && this.capturedMedia instanceof Blob) {
            URL.revokeObjectURL(URL.createObjectURL(this.capturedMedia));
        }
        
        this.capturedMedia = null;
        this.mediaType = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentAWB = '';
        
        // Reset UI elements
        const previewImage = document.getElementById('preview-image');
        const previewVideo = document.getElementById('preview-video');
        const mediaPreview = document.getElementById('media-preview');
        
        if (previewImage) {
            previewImage.src = '';
            previewImage.style.display = 'none';
        }
        
        if (previewVideo) {
            previewVideo.src = '';
            previewVideo.style.display = 'none';
        }
        
        if (mediaPreview) {
            mediaPreview.style.display = 'none';
        }
        
        // Reset camera controls
        const captureBtn = document.getElementById('capture-photo');
        const recordBtn = document.getElementById('record-video');
        const retakeBtn = document.getElementById('retake-media');
        const confirmBtn = document.getElementById('confirm-media');
        
        if (captureBtn) captureBtn.style.display = 'inline-block';
        if (recordBtn) recordBtn.style.display = 'inline-block';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'none';
        
        // Reset upload progress
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('upload-status').textContent = '';
        document.getElementById('upload-success').style.display = 'none';
        document.getElementById('upload-error').style.display = 'none';
        document.querySelector('.upload-progress').style.display = 'block';
    }

    init() {
        this.setupEventListeners();
        this.loadRecentDeliveries();
        this.checkOnlineStatus();
        this.registerServiceWorker();
    }

    setupEventListeners() {
        // Home screen navigation
        document.getElementById('start-scan').addEventListener('click', () => this.showScanner());
        
        // Scanner screen controls
        document.getElementById('manual-entry').addEventListener('click', () => this.showManualEntry());
        document.getElementById('cancel-scan').addEventListener('click', () => this.showHome());
        document.getElementById('confirm-manual').addEventListener('click', () => this.confirmManualEntry());
        document.getElementById('cancel-manual').addEventListener('click', () => this.hideManualEntry());
        
        // Camera screen controls
        document.getElementById('capture-photo').addEventListener('click', () => this.capturePhoto());
        document.getElementById('record-video').addEventListener('click', () => this.toggleVideoRecording());
        document.getElementById('retake-media').addEventListener('click', () => this.retakeMedia());
        document.getElementById('confirm-media').addEventListener('click', () => this.confirmMedia());
        document.getElementById('back-to-scanner').addEventListener('click', () => this.showScanner());
        
        // Upload screen controls
        document.getElementById('new-delivery').addEventListener('click', () => {
            this.initializeNewDelivery();
            this.showHome();
        });
        document.getElementById('retry-upload').addEventListener('click', () => this.retryUpload());
        document.getElementById('save-offline').addEventListener('click', () => this.saveOffline());
        
        // Manual AWB entry
        document.getElementById('manual-awb').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmManualEntry();
        });
        
        // Network status monitoring
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
    }

    // Screen Management
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showHome() {
        this.initializeNewDelivery();
        this.showScreen('home-screen');
        this.loadRecentDeliveries();
    }

    showScanner() {
        this.showScreen('scanner-screen');
        this.startBarcodeScanner();
    }

    showCamera() {
        this.showScreen('camera-screen');
        document.getElementById('current-awb').textContent = this.currentAWB;
        this.startCamera();
    }

    showUpload() {
        this.showScreen('upload-screen');
        document.querySelector('#upload-awb span').textContent = this.currentAWB;
        this.startUpload();
    }

    // Barcode Scanner Implementation
    startBarcodeScanner() {
        const video = document.getElementById('scanner-video');
        
        navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        })
        .then(stream => {
            video.srcObject = stream;
            this.initQuagga();
        })
        .catch(err => {
            console.error('Camera access denied:', err);
            this.showError('Camera access is required for scanning. Please allow camera access and try again.');
        });
    }

    initQuagga() {
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#scanner-video'),
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                }
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader", 
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader"
                ]
            }
        }, (err) => {
            if (err) {
                console.error('Quagga initialization failed:', err);
                this.showError('Scanner initialization failed. Please try manual entry.');
                return;
            }
            Quagga.start();
            
            Quagga.onDetected((data) => {
                this.onBarcodeDetected(data.codeResult.code);
            });
        });
    }

    onBarcodeDetected(code) {
        if (code && code.length >= 8) {
            this.currentAWB = code.toUpperCase();
            this.stopScanner();
            this.showCamera();
        }
    }

    stopScanner() {
        if (typeof Quagga !== 'undefined') {
            Quagga.stop();
        }
        
        const video = document.getElementById('scanner-video');
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
    }

    // Manual AWB Entry
    showManualEntry() {
        document.getElementById('manual-modal').classList.add('active');
        document.getElementById('manual-awb').focus();
    }

    hideManualEntry() {
        document.getElementById('manual-modal').classList.remove('active');
        document.getElementById('manual-awb').value = '';
    }

    confirmManualEntry() {
        const awb = document.getElementById('manual-awb').value.trim().toUpperCase();
        if (awb.length >= 8) {
            this.currentAWB = awb;
            this.hideManualEntry();
            this.stopScanner();
            this.showCamera();
        } else {
            alert('Please enter a valid AWB number (minimum 8 characters)');
        }
    }

    // Camera and Media Capture
    startCamera() {
        const video = document.getElementById('camera-video');
        
        navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: true
        })
        .then(stream => {
            video.srcObject = stream;
            this.cameraStream = stream;
        })
        .catch(err => {
            console.error('Camera access denied:', err);
            this.showError('Camera access is required. Please allow camera access and try again.');
        });
    }

    capturePhoto() {
        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('photo-canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
            this.capturedMedia = blob;
            this.mediaType = 'photo';
            this.showMediaPreview(blob, 'photo');
        }, 'image/jpeg', 0.9);
    }

    toggleVideoRecording() {
        if (!this.isRecording) {
            this.startVideoRecording();
        } else {
            this.stopVideoRecording();
        }
    }

    startVideoRecording() {
        if (!this.cameraStream) {
            this.showError('Camera not available');
            return;
        }

        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(this.cameraStream, {
            mimeType: 'video/webm'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            this.capturedMedia = blob;
            this.mediaType = 'video';
            this.showMediaPreview(blob, 'video');
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        
        const recordBtn = document.getElementById('record-video');
        recordBtn.textContent = '⏹️ Stop Recording';
        recordBtn.classList.add('btn-danger');
        
        // Auto-stop recording after 30 seconds
        setTimeout(() => {
            if (this.isRecording) {
                this.stopVideoRecording();
            }
        }, 30000);
    }

    stopVideoRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            const recordBtn = document.getElementById('record-video');
            recordBtn.textContent = '🎥 Record Video';
            recordBtn.classList.remove('btn-danger');
        }
    }

    showMediaPreview(blob, type) {
        const preview = document.getElementById('media-preview');
        const img = document.getElementById('preview-image');
        const video = document.getElementById('preview-video');
        
        if (type === 'photo') {
            img.src = URL.createObjectURL(blob);
            img.style.display = 'block';
            video.style.display = 'none';
        } else {
            video.src = URL.createObjectURL(blob);
            video.style.display = 'block';
            img.style.display = 'none';
        }
        
        preview.style.display = 'block';
        
        // Update control buttons
        document.getElementById('retake-media').style.display = 'inline-block';
        document.getElementById('confirm-media').style.display = 'inline-block';
        document.getElementById('capture-photo').style.display = 'none';
        document.getElementById('record-video').style.display = 'none';
    }

    retakeMedia() {
        this.capturedMedia = null;
        this.mediaType = null;
        
        // Reset UI
        document.getElementById('media-preview').style.display = 'none';
        document.getElementById('retake-media').style.display = 'none';
        document.getElementById('confirm-media').style.display = 'none';
        document.getElementById('capture-photo').style.display = 'inline-block';
        document.getElementById('record-video').style.display = 'inline-block';
    }

    confirmMedia() {
        if (this.capturedMedia) {
            this.stopCamera();
            this.showUpload();
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    // Upload System - Currently saves locally, S3 support planned for future versions
    async startUpload() {
        try {
            this.updateUploadStatus('Preparing upload...', 10);
            
            // TODO: Future S3 integration - Get pre-signed URL from backend
            // const uploadData = await this.getPresignedUrl();
            
            this.updateUploadStatus('Processing...', 50);
            
            // TODO: Future S3 integration - Upload to S3
            // await this.uploadToS3(uploadData);
            
            this.updateUploadStatus('Saving locally...', 80);
            
            // Current implementation: Save metadata locally
            await this.saveMetadataLocally();
            
            this.updateUploadStatus('Upload complete!', 100);
            
            // Clear media state before showing success
            const oldMedia = this.capturedMedia;
            this.capturedMedia = null;
            this.mediaType = null;
            
            // Clean up object URLs
            if (oldMedia && oldMedia instanceof Blob) {
                URL.revokeObjectURL(URL.createObjectURL(oldMedia));
            }
            
            this.showUploadSuccess();
            
        } catch (error) {
            console.error('Upload failed:', error);
            this.showUploadError(error.message);
        }
    }

    // Future S3 implementation methods (placeholder for next version)
    async getPresignedUrl() {
        const extension = this.mediaType === 'photo' ? 'jpg' : 'webm';
        const filename = `${this.currentAWB}_${this.mediaType}_${Date.now()}.${extension}`;
        
        const response = await fetch(`${this.config.apiEndpoint}/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: filename,
                contentType: this.capturedMedia.type,
                awb: this.currentAWB
            })
        });
        
        if (!response.ok) throw new Error('Failed to get upload URL');
        return await response.json();
    }

    async uploadToS3(uploadData) {
        const formData = new FormData();
        Object.keys(uploadData.fields).forEach(key => {
            formData.append(key, uploadData.fields[key]);
        });
        formData.append('file', this.capturedMedia);
        
        const response = await fetch(uploadData.url, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to upload to S3');
    }

    // Current implementation: Local storage
    async saveMetadataLocally() {
        const metadata = {
            awb: this.currentAWB,
            filename: `${this.currentAWB}_${this.mediaType}_${Date.now()}`,
            mediaType: this.mediaType,
            timestamp: new Date().toISOString(),
            fileSize: this.capturedMedia ? this.capturedMedia.size : 0,
            status: 'completed'
        };
        
        // Always save media data for preview functionality
        if (this.capturedMedia) {
            try {
                // Convert blob to base64 data URL
                metadata.mediaData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read media for local save'));
                    reader.readAsDataURL(this.capturedMedia);
                });
                console.log('Media data saved successfully');
            } catch (err) {
                console.error('Failed to include media data in local metadata:', err);
                metadata.status = 'media_error';
            }
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.saveToLocalStorage(metadata);
    }

    updateUploadStatus(message, progress) {
        document.getElementById('upload-status').textContent = message;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    showUploadSuccess() {
        document.getElementById('upload-success').style.display = 'block';
        document.querySelector('.upload-progress').style.display = 'none';
        
        // Clear captured media and reset state
        this.capturedMedia = null;
        this.mediaType = null;
        this.currentAWB = '';
    }

    showUploadError(message) {
        document.getElementById('upload-error').style.display = 'block';
        document.getElementById('error-details').textContent = message;
        document.querySelector('.upload-progress').style.display = 'none';
    }

    retryUpload() {
        // Reset upload screen
        document.getElementById('upload-success').style.display = 'none';
        document.getElementById('upload-error').style.display = 'none';
        document.querySelector('.upload-progress').style.display = 'block';
        document.getElementById('progress-fill').style.width = '0%';
        
        this.startUpload();
    }

    // Local Storage and Offline Support
    saveToLocalStorage(metadata) {
        const deliveries = JSON.parse(localStorage.getItem('pod_deliveries') || '[]');
        deliveries.unshift(metadata);
        
        // Keep only last 50 deliveries
        if (deliveries.length > 50) {
            deliveries.splice(50);
        }
        
        localStorage.setItem('pod_deliveries', JSON.stringify(deliveries));
    }

    saveOffline() {
        const metadata = {
            awb: this.currentAWB,
            mediaType: this.mediaType,
            timestamp: new Date().toISOString(),
            fileSize: this.capturedMedia.size,
            status: 'pending'
        };
        
        // Save media as base64 for offline storage
        const reader = new FileReader();
        reader.onload = () => {
            metadata.mediaData = reader.result;
            this.saveToLocalStorage(metadata);
            
            alert('Delivery saved offline. Will be synced when S3 integration is added.');
            this.showHome();
        };
        reader.readAsDataURL(this.capturedMedia);
    }

    loadRecentDeliveries() {
        const deliveries = JSON.parse(localStorage.getItem('pod_deliveries') || '[]');
        const recentList = document.getElementById('recent-list');
        
        if (deliveries.length === 0) {
            recentList.innerHTML = '<p style="text-align: center; color: #666;">No recent deliveries</p>';
            return;
        }
        
        recentList.innerHTML = deliveries.slice(0, 5).map(delivery => `
            <div class="recent-item" data-awb="${delivery.awb}">
                <span class="awb">${delivery.awb}</span>
                <span class="status ${delivery.status || 'completed'}">${delivery.status || 'completed'}</span>
            </div>
        `).join('');

        // Add click handlers for recent items
        recentList.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => this.showDeliveryPreview(item.dataset.awb));
        });
    }

    async showDeliveryPreview(awb) {
        const deliveries = JSON.parse(localStorage.getItem('pod_deliveries') || '[]');
        const delivery = deliveries.find(d => d.awb === awb);
        
        if (!delivery) {
            alert('Delivery not found');
            return;
        }

        const modal = document.getElementById('media-preview-modal');
        const previewAwb = document.getElementById('preview-awb');
        const previewImage = document.getElementById('modal-preview-image');
        const previewVideo = document.getElementById('modal-preview-video');
        
        previewAwb.textContent = `AWB: ${delivery.awb}`;
        
        // Reset previews
        previewImage.style.display = 'none';
        previewVideo.style.display = 'none';
        
        if (delivery.mediaData) {
            if (delivery.mediaType === 'photo') {
                previewImage.src = delivery.mediaData;
                previewImage.style.display = 'block';
            } else if (delivery.mediaType === 'video') {
                previewVideo.src = delivery.mediaData;
                previewVideo.style.display = 'block';
            }
        } else {
            previewAwb.textContent += ' (No media available)';
        }
        
        modal.classList.add('active');
        
        // Close button handler
        const closeBtn = document.getElementById('close-preview');
        const closeHandler = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', closeHandler);
        };
        closeBtn.addEventListener('click', closeHandler);
    }

    // Utility Functions
    updateConnectionStatus(isOnline) {
        const status = document.getElementById('connection-status');
        if (isOnline) {
            status.textContent = 'Online';
            status.classList.remove('offline');
        } else {
            status.textContent = 'Offline';
            status.classList.add('offline');
        }
    }

    checkOnlineStatus() {
        this.updateConnectionStatus(navigator.onLine);
    }

    showError(message) {
        alert(message);
    }

    showLoading(show = true) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    resetState() {
        // Clear media and AWB
        this.capturedMedia = null;
        this.mediaType = null;
        this.currentAWB = '';
        this.recordedChunks = [];
        
        // Reset UI elements
        const preview = document.getElementById('media-preview');
        const img = document.getElementById('preview-image');
        const video = document.getElementById('preview-video');
        
        if (preview) preview.style.display = 'none';
        if (img) img.src = '';
        if (video) video.src = '';
        
        // Reset upload progress
        const progressBar = document.getElementById('progress-fill');
        if (progressBar) progressBar.style.width = '0%';
        
        // Hide success/error messages
        const successMsg = document.getElementById('upload-success');
        const errorMsg = document.getElementById('upload-error');
        if (successMsg) successMsg.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'none';
        
        // Show progress container
        const progressContainer = document.querySelector('.upload-progress');
        if (progressContainer) progressContainer.style.display = 'block';
    }

    // Service Worker Registration for PWA
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered successfully');
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }
}

// Initialize PWA when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.podApp = new PODApp();
});

// PWA install prompt handling
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('PWA install prompt available');
});