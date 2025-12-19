const S3 = require('../libraries/s3/s3.lib.js');

const s3Instance = new S3();

const generateUploadUrl = async ({ key, expiresIn, contentType }) => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Key is required and must be a non-empty string');
  }

  const sanitizedKey = key.trim();
  
  // Generate IST timestamp (UTC+5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  const timestamp = istTime.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  
  const keyWithTimestamp = `${timestamp}_${sanitizedKey}`;
  const expiration = expiresIn || 3600;
  
  const signedUrl = await s3Instance.generateUploadSignedUrl(
    keyWithTimestamp, 
    expiration, 
    contentType
  );
  
  return {
    url: signedUrl,
    key: sanitizedKey,
    expiresIn: expiration,
    bucket: s3Instance.getBucket()
  };
};

module.exports = {
  generateUploadUrl
};
