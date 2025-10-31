const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// AWS Configuration - Currently for testing, S3 integration planned for future
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

// In-memory storage for demo (use database in production)
const deliveries = [];

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Future S3 Integration: Generate pre-signed URL for S3 upload
app.post('/api/presigned-url', async (req, res) => {
    try {
        const { filename, contentType, awb } = req.body;
        
        if (!filename || !contentType || !awb) {
            return res.status(400).json({ 
                error: 'Missing required fields: filename, contentType, awb' 
            });
        }
        
        // Generate S3 key structure
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const uniqueId = uuidv4();
        
        const key = `pods/${year}/${month}/${day}/${awb}_${uniqueId}_${filename}`;
        
        const params = {
            Bucket: bucketName,
            Key: key,
            Expires: 300, // 5 minutes
            ContentType: contentType,
            Conditions: [
                ['content-length-range', 0, 50 * 1024 * 1024], // Max 50MB
                ['starts-with', '$Content-Type', contentType.split('/')[0]]
            ]
        };
        
        const presignedPost = s3.createPresignedPost(params);
        
        res.json({
            url: presignedPost.url,
            fields: presignedPost.fields,
            filename: filename,
            s3Key: key
        });
        
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        res.status(500).json({ 
            error: 'Failed to generate upload URL - S3 not configured',
            details: error.message 
        });
    }
});

// Save delivery metadata
app.post('/api/delivery', async (req, res) => {
    try {
        const { awb, filename, mediaType, timestamp, fileSize, s3Key } = req.body;
        
        if (!awb || !filename || !mediaType) {
            return res.status(400).json({ 
                error: 'Missing required fields: awb, filename, mediaType' 
            });
        }
        
        const delivery = {
            id: uuidv4(),
            awb,
            filename,
            mediaType,
            timestamp: timestamp || new Date().toISOString(),
            fileSize,
            s3Key,
            s3Url: s3Key ? `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}` : null,
            status: 'completed',
            createdAt: new Date().toISOString()
        };
        
        deliveries.push(delivery);
        console.log(`Delivery saved: ${awb} - ${filename}`);
        
        res.json({
            success: true,
            delivery: delivery
        });
        
    } catch (error) {
        console.error('Error saving delivery:', error);
        res.status(500).json({ 
            error: 'Failed to save delivery',
            details: error.message 
        });
    }
});

// Get deliveries for admin/reporting
app.get('/api/deliveries', (req, res) => {
    const { awb, limit = 50 } = req.query;
    
    let filteredDeliveries = deliveries;
    
    if (awb) {
        filteredDeliveries = deliveries.filter(d => 
            d.awb.toLowerCase().includes(awb.toLowerCase())
        );
    }
    
    // Sort by most recent first and limit results
    const sortedDeliveries = filteredDeliveries
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const result = sortedDeliveries.slice(0, Number.parseInt(limit, 10));
    
    res.json({
        deliveries: result,
        total: filteredDeliveries.length
    });
});

// Get specific delivery by AWB
app.get('/api/delivery/:awb', (req, res) => {
    const { awb } = req.params;
    
    const delivery = deliveries.find(d => d.awb === awb);
    
    if (!delivery) {
        return res.status(404).json({ 
            error: 'Delivery not found' 
        });
    }
    
    res.json(delivery);
});

// Delete delivery - For cleanup (Future S3 integration)
app.delete('/api/delivery/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const deliveryIndex = deliveries.findIndex(d => d.id === id);
        
        if (deliveryIndex === -1) {
            return res.status(404).json({ 
                error: 'Delivery not found' 
            });
        }
        
        const delivery = deliveries[deliveryIndex];
        
        // Future S3 integration: Delete from S3 if requested
        if (req.query.deleteFromS3 === 'true' && delivery.s3Key) {
            await s3.deleteObject({
                Bucket: bucketName,
                Key: delivery.s3Key
            }).promise();
        }
        
        deliveries.splice(deliveryIndex, 1);
        
        res.json({ 
            success: true, 
            message: 'Delivery deleted successfully' 
        });
        
    } catch (error) {
        console.error('Error deleting delivery:', error);
        res.status(500).json({ 
            error: 'Failed to delete delivery',
            details: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start server
app.listen(port, () => {
    console.log(`POD Backend API running on port ${port}`);
    console.log(`S3 Bucket: ${bucketName} (${bucketName === 'test-pod-bucket' ? 'TEST MODE' : 'PRODUCTION'})`);
    console.log(`AWS Region: ${process.env.AWS_REGION}`);
    console.log('Available Endpoints:');
    console.log('  GET  /health - Health check');
    console.log('  POST /api/presigned-url - Generate S3 upload URL (Future)');
    console.log('  POST /api/delivery - Save delivery metadata');
    console.log('  GET  /api/deliveries - List all deliveries');
    console.log('  GET  /api/delivery/:awb - Get specific delivery');
    console.log('  DELETE /api/delivery/:id - Delete delivery');
});