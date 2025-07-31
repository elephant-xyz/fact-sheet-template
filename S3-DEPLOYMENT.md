# S3 Deployment Guide

This guide explains how to deploy your fact sheet templates to S3 for use with CloudFront.

## Overview

The deployment process:
1. Downloads HTML from IPFS using parallel gateways for speed
2. Copies local assets (CSS, JS, images, fonts, etc.) instead of downloading from IPFS
3. Updates HTML files to reference S3 URLs
4. Uploads everything to your S3 bucket

**Speed Improvements:**
- ⚡ **Parallel downloads**: Tries multiple IPFS gateways simultaneously
- ⚡ **Local assets**: Uses local template files instead of downloading from IPFS
- ⚡ **Shorter timeouts**: 15 seconds instead of 30 seconds per gateway
- ⚡ **Fewer retries**: 1 retry instead of 3 to reduce total time

## Prerequisites

### 1. AWS CLI Installation
```bash
# macOS
brew install awscli

# Ubuntu/Debian
sudo apt-get install awscli

# Windows
# Download from https://aws.amazon.com/cli/
```

### 2. AWS Credentials Setup
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter your output format (json)
```

### 3. Environment Variables
Create a `.env` file in your project root:
```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=us-east-1
S3_BUCKET=your-bucket-name
```

## S3 Bucket Setup

### 1. Create S3 Bucket
```bash
aws s3 mb s3://your-bucket-name
```

### 2. Configure Bucket for Static Website Hosting
```bash
aws s3 website s3://your-bucket-name --index-document index.html --error-document error.html
```

### 3. Set Bucket Policy for Public Read Access
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## Deployment Commands

### Single Property Deployment
```bash
# Deploy from IPFS URL
node bin/deploy-to-s3.js deploy -p property-id-123 -u https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa

# Deploy from local path
node bin/deploy-to-s3.js deploy -p property-id-123 -l ./example-output/property-id-123

# Dry run (test without uploading)
node bin/deploy-to-s3.js deploy -p property-id-123 -u https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa --dry-run
```

### Batch Deployment from CSV
```bash
# Deploy all properties from CSV file
node bin/deploy-to-s3.js deploy-from-csv -c upload-results.csv

# Dry run for CSV deployment
node bin/deploy-to-s3.js deploy-from-csv -c upload-results.csv --dry-run
```

## CloudFront Setup

### 1. Create CloudFront Distribution
1. Go to AWS CloudFront console
2. Click "Create Distribution"
3. Set Origin Domain to your S3 bucket
4. Configure settings:
   - **Origin Path**: Leave empty
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS
   - **Cache Policy**: Use managed policy "CachingOptimized"

### 2. Configure Error Pages
- **403 Error**: Redirect to `/index.html` (200)
- **404 Error**: Redirect to `/index.html` (200)

### 3. Set Custom Domain (Optional)
1. Add your domain to the distribution
2. Upload SSL certificate to AWS Certificate Manager
3. Update DNS records to point to CloudFront

## Asset Structure

The deployment creates this structure in S3:

```
s3://your-bucket/
├── homes/
│   └── property-id-123/  # Property-specific directory with all files
│       ├── index.html    # Property fact sheet
│       ├── css/          # CSS files
│       ├── js/           # JavaScript files
│       ├── *.svg         # Icons and images
│       ├── *.png         # Images
│       └── *.woff        # Fonts
```

## Testing Deployment

### 1. Test Script
```bash
node test-deploy-s3.js
```

### 2. Manual Testing
```bash
# Test with dry run
node bin/deploy-to-s3.js deploy -p test-property -u https://ipfs.io/ipfs/bafkreigzz5foh5ts76vvhxphzulptpnjwznog6lcnxw5wsvfqa7zlxeioa --dry-run --verbose
```

### 3. Verify Assets
After deployment, check that all assets are accessible:
- Property page: `https://your-bucket.s3.region.amazonaws.com/homes/property-id/index.html`
- CSS files: `https://your-bucket.s3.region.amazonaws.com/homes/property-id/css/`
- JS files: `https://your-bucket.s3.region.amazonaws.com/homes/property-id/js/`
- Images: `https://your-bucket.s3.region.amazonaws.com/homes/property-id/*.svg`

## Troubleshooting

### Common Issues

1. **Assets not loading**
   - Check that all assets were uploaded to `homes/public/`
   - Verify HTML files reference correct S3 URLs
   - Check CloudFront cache settings

2. **CORS errors**
   - Add CORS configuration to S3 bucket:
   ```json
   [
       {
           "AllowedHeaders": ["*"],
           "AllowedMethods": ["GET"],
           "AllowedOrigins": ["*"],
           "ExposeHeaders": []
       }
   ]
   ```

3. **404 errors**
   - Ensure CloudFront error pages redirect to `/index.html`
   - Check that HTML files are uploaded to correct paths

4. **Permission errors**
   - Verify AWS credentials have S3 write permissions
   - Check bucket policy allows uploads

### Debug Commands

```bash
# List all files in S3 bucket
aws s3 ls s3://your-bucket/homes/ --recursive

# Check specific property (includes all assets)
aws s3 ls s3://your-bucket/homes/property-id-123/

# Download and inspect HTML
aws s3 cp s3://your-bucket/homes/property-id-123/index.html ./temp.html
cat ./temp.html
```

## Performance Optimization

### 1. CloudFront Caching
- Set appropriate cache headers for different file types
- Use cache invalidation for updates

### 2. Asset Optimization
- Consider compressing images before upload
- Minify CSS and JS files
- Use WebP format for images where possible

### 3. CDN Configuration
- Enable compression in CloudFront
- Set appropriate TTL values
- Configure geographic distribution

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Access Control**: Consider using signed URLs for private content
3. **Bucket Policy**: Restrict access as needed
4. **Monitoring**: Set up CloudWatch alarms for unusual activity

## Cost Optimization

1. **Storage**: Use lifecycle policies to move old files to cheaper storage
2. **Transfer**: Monitor CloudFront data transfer costs
3. **Requests**: Optimize cache hit rates to reduce origin requests
4. **Invalidation**: Minimize cache invalidations (they cost money) 