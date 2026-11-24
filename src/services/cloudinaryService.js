const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

if (!CLOUD_NAME || !UPLOAD_PRESET) {
  console.error(
    "Cloudinary configuration missing. Please verify VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env"
  );
}

/**
 * Upload an image file to Cloudinary using unsigned upload preset
 * @param {File|Blob} file - The image file to upload
 * @param {Function} [onProgress] - Optional progress callback (percent: number 0-100)
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export function uploadImage(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      const err = new Error("Cloudinary credentials are not configured.");
      console.error(err.message);
      return reject(err);
    }

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.secure_url || response.url,
            publicId: response.public_id,
          });
        } catch {
          reject(new Error("Invalid response received from Cloudinary."));
        }
      } else {
        try {
          const errorResp = JSON.parse(xhr.responseText);
          reject(
            new Error(
              errorResp?.error?.message ||
                `Cloudinary upload failed with status ${xhr.status}`
            )
          );
        } catch {
          reject(
            new Error(`Cloudinary upload failed with status ${xhr.status}`)
          );
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during Cloudinary upload."));
    };

    xhr.send(formData);
  });
}

/**
 * Generate a thumbnail URL with Cloudinary transformation
 * Inserts w_{width},c_fill,f_auto,q_auto after /upload/
 * @param {string} url
 * @param {number} [width=200]
 * @returns {string}
 */
export function thumbUrl(url, width = 200) {
  if (!url || typeof url !== "string") return "";
  if (!url.includes("/upload/")) return url;

  const transform = `w_${width},c_fill,f_auto,q_auto`;
  if (url.includes(`/upload/${transform}/`)) return url;

  // Insert transform after /upload/ (handles any existing transform segment)
  return url.replace(/\/upload\/(?:[a-z]_[^/]+\/)?/, `/upload/${transform}/`);
}

/**
 * Client-side image compression using HTML Canvas
 * Resizes longest side to max 1600px and encodes to JPEG at 0.8 quality
 * @param {File} file
 * @param {number} [maxDimension=1600]
 * @param {number} [quality=0.8]
 * @returns {Promise<File>}
 */
export async function compressImage(file, maxDimension = 1600, quality = 0.8) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Only image files are supported");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName =
              file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            const compressedFile = new File([blob], cleanName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
