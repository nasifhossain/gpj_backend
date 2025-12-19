const S3 = require('../libraries/s3/s3.lib.js');

const s3Instance = new S3();

const generateUploadUrl = async ({ key, expiresIn, contentType }) => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Key is required and must be a non-empty string');
  }

  const sanitizedKey = key.trim();
  const expiration = expiresIn || 3600;
  
  const signedUrl = await s3Instance.generateUploadSignedUrl(
    sanitizedKey, 
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
