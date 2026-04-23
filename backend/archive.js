import AWS from "aws-sdk";

export const s3 = new AWS.S3({
  endpoint: "https://s3.us.archive.org",
  accessKeyId: process.env.ARCHIVE_ACCESS_KEY,
  secretAccessKey: process.env.ARCHIVE_SECRET_KEY,
  signatureVersion: "v2",
  region: "us-east-1"
});
