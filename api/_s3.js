import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getS3Client() {
  return new S3Client({
    region: process.env.SOCIALBUZZ_AWS_S3_REGION,
    credentials: {
      accessKeyId:     process.env.SOCIALBUZZ_AWS_S3_KEY,
      secretAccessKey: process.env.SOCIALBUZZ_AWS_S3_SECRET,
    },
  });
}

const MAX_BASE64_LENGTH = 50 * 1024 * 1024; // 50 MB base64 ≈ 37.5 MB binary

export async function uploadToS3(base64Data, key, contentType) {
  const bucket = process.env.SOCIALBUZZ_AWS_S3_BUCKET;
  if (!bucket || !process.env.SOCIALBUZZ_AWS_S3_KEY || !process.env.SOCIALBUZZ_AWS_S3_SECRET) {
    throw new Error('AWS S3 credentials not configured. Add SOCIALBUZZ_AWS_S3_KEY, SOCIALBUZZ_AWS_S3_SECRET, SOCIALBUZZ_AWS_S3_REGION, SOCIALBUZZ_AWS_S3_BUCKET to env vars.');
  }
  if (base64Data.length > MAX_BASE64_LENGTH) throw new Error('File too large (max 37.5 MB).');
  const buffer = Buffer.from(base64Data, 'base64');

  const uploadPromise = getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
  );
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('S3 upload timed out — please try again.')), 15_000),
  );
  await Promise.race([uploadPromise, timeoutPromise]);

  const url = `https://${bucket}.s3.${process.env.SOCIALBUZZ_AWS_S3_REGION}.amazonaws.com/${key}`;
  return { url, key };
}
