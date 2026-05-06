import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

const streamifier = require('streamifier');

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.logger.log('Initializing Cloudinary for: ' + cloudName);

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      this.logger.log('Uploading image: ' + file.originalname);

      const upload = cloudinary.uploader.upload_stream(
        {
          folder: 'deepskyn_analysis', // THIS is the folder in Cloudinary
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary error: ' + error.message);
            return reject(error);
          }

          if (!result) {
            return reject(new Error('Upload failed'));
          }

          this.logger.log('Upload Success!');
          this.logger.log('Public ID: ' + result.public_id);
          this.logger.log('Image URL: ' + result.secure_url);

          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(upload);
    });
  }
}
