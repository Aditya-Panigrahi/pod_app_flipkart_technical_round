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
        document.getElementById('new-delivery').addEventListener('click', () => this.showHome());
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
            fileSize: this.capturedMedia.size,
            status: 'completed'
        };
        
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
            <div class="recent-item">
                <span class="awb">${delivery.awb}</span>
                <span class="status ${delivery.status || 'completed'}">${delivery.status || 'completed'}</span>
            </div>
        `).join('');
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

    // Service Worker Registration for PWA
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./public/sw.js');
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