import React, { useState, useRef, useId, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { imagesApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  category?: string;
  singleMode?: boolean;
  accept?: string; // Add accept prop for file types
  fileType?: 'image' | 'document' | 'video' | 'any'; // Add fileType prop
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 10,
  category = 'products',
  singleMode = false,
  accept,
  fileType = 'image'
}) => {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uniqueId = useId(); // Generate unique ID for this instance
  const { toast } = useToast();

  // Debug: Check if file input is mounted
  useEffect(() => {
    console.log(`[ImageUpload ${uniqueId}] Component mounted`);
    console.log(`[ImageUpload ${uniqueId}] FileType:`, fileType);
    console.log(`[ImageUpload ${uniqueId}] Category:`, category);
    console.log(`[ImageUpload ${uniqueId}] File input ref after mount:`, fileInputRef.current);
    console.log(`[ImageUpload ${uniqueId}] Accept attribute:`, getAcceptAttribute());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine accept attribute based on fileType
  const getAcceptAttribute = () => {
    if (accept) return accept;
    switch (fileType) {
      case 'image':
        return 'image/*';
      case 'document':
        // Simplified - just use file extensions for better compatibility
        return '.pdf,.doc,.docx,.jpg,.jpeg,.png';
      case 'video':
        return 'video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogg,.mov';
      case 'any':
        return '*/*';
      default:
        return 'image/*';
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type based on fileType prop
    if (fileType === 'image' && !file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    if (fileType === 'video' && !['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'].includes(file.type)) {
      toast({
        title: 'Unsupported video format',
        description: 'Please select an MP4, WebM, MOV or OGG file',
        variant: 'destructive'
      });
      return;
    }

    if (fileType === 'document') {
      const validDocTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];
      if (!validDocTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF, DOC, DOCX, JPG, or PNG file',
          variant: 'destructive'
        });
        return;
      }
    }

    // Increase size limit for documents and videos
    const maxSize = fileType === 'video' ? 15 * 1024 * 1024 : 10 * 1024 * 1024; // 15MB for videos, 10MB for others
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Please select a file smaller than ${maxSize / (1024 * 1024)}MB`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const result = await imagesApi.upload(file);
      if (singleMode) {
        onImagesChange([result.image.url]);
      } else {
        const newImages = [...images, result.image.url];
        onImagesChange(newImages);
      }
      toast({
        title: 'Image uploaded',
        description: 'Image uploaded successfully'
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlAdd = () => {
    const newImages = [...images, ''];
    onImagesChange(newImages);
  };

  const handleUrlChange = (index: number, value: string) => {
    const newImages = [...images];
    newImages[index] = value;
    onImagesChange(newImages);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const filteredImages = images.filter(img => img.trim() !== '');

  const getLabel = () => {
    if (fileType === 'video') return 'Videos';
    if (fileType === 'document') return 'Documents';
    return 'Images';
  };

  const handleUploadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('=== UPLOAD BUTTON CLICKED ===');
    console.log('FileType:', fileType);
    console.log('Accept attribute:', getAcceptAttribute());
    console.log('File input ref exists:', !!fileInputRef.current);
    console.log('Button disabled:', uploading || (!singleMode && filteredImages.length >= maxImages));
    
    if (!fileInputRef.current) {
      console.error('ERROR: File input ref is NULL!');
      toast({
        title: 'Error',
        description: 'File input not found. Please refresh the page.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      console.log('Attempting to click file input...');
      fileInputRef.current.click();
      console.log('File input click() called successfully');
    } catch (error) {
      console.error('ERROR clicking file input:', error);
      toast({
        title: 'Error',
        description: 'Failed to open file picker',
        variant: 'destructive'
      });
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading || (!singleMode && filteredImages.length >= maxImages)) {
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  return (
    <div className="space-y-4">
      <Label>{getLabel()} ({filteredImages.length}/{maxImages})</Label>

      {/* Drag and Drop Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-all
          ${isDragging 
            ? 'border-primary bg-primary/10 scale-105' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
          }
          ${uploading || (!singleMode && filteredImages.length >= maxImages) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={(e) => {
          console.log('=== DRAG-DROP AREA CLICKED ===');
          console.log('Event target:', e.target);
          console.log('Current target:', e.currentTarget);
          console.log('FileType:', fileType);
          console.log('Category:', category);
          console.log('Uploading:', uploading);
          console.log('SingleMode:', singleMode);
          console.log('Filtered images length:', filteredImages.length);
          console.log('Max images:', maxImages);
          console.log('Can upload:', !uploading && !((!singleMode && filteredImages.length >= maxImages)));
          console.log('File input ref exists:', !!fileInputRef.current);
          console.log('File input element:', fileInputRef.current);
          
          const canUpload = !uploading && !((!singleMode && filteredImages.length >= maxImages));
          console.log('Can upload decision:', canUpload);
          
          if (canUpload && fileInputRef.current) {
            console.log('Attempting to click file input...');
            try {
              fileInputRef.current.click();
              console.log('File input click executed');
            } catch (error) {
              console.error('Error clicking file input:', error);
            }
          } else {
            if (!canUpload) console.warn('Upload blocked - conditions not met');
            if (!fileInputRef.current) console.error('File input ref is NULL!');
          }
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className={`w-8 h-8 ${isDragging ? 'text-primary animate-bounce' : 'text-gray-400'}`} />
          <div className="text-sm">
            <span className="font-medium text-primary">Click to upload</span>
            <span className="text-gray-500"> or drag and drop</span>
          </div>
          <p className="text-xs text-gray-500">
            {fileType === 'video' 
              ? 'MP4, WebM, MOV or OGG up to 15MB' 
              : fileType === 'document' 
              ? 'PDF, DOC, DOCX, JPG, PNG up to 10MB'
              : 'PNG, JPG, GIF up to 10MB'}
          </p>
        </div>
      </div>

      {/* Upload Button (Alternative) */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          disabled={uploading || (!singleMode && filteredImages.length >= maxImages)}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : `Browse ${fileType === 'video' ? 'Videos' : fileType === 'document' ? 'Documents' : 'Images'}`}
        </Button>
        {!singleMode && (
          <Button
            type="button"
            variant="outline"
            onClick={handleUrlAdd}
            disabled={filteredImages.length >= maxImages}
          >
            Add URL
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptAttribute()}
        onChange={(e) => {
          console.log('=== FILE INPUT CHANGE EVENT ===');
          console.log('Files selected:', e.target.files?.length || 0);
          console.log('File input value:', e.target.value);
          if (e.target.files && e.target.files.length > 0) {
            console.log('First file:', e.target.files[0].name, e.target.files[0].type);
          }
          handleFileUpload(e.target.files);
        }}
        multiple={!singleMode}
        className="hidden"
        aria-label="File upload input"
        id={`file-upload-${uniqueId}`}
      />

      {/* Image display */}
      {singleMode ? (
        // Single image mode
        <div className="space-y-2">
          {images[0] ? (
            <div className="flex items-center gap-2 p-2 border rounded">
              {images[0].startsWith('http') ? (
                <>
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={images[0]}
                    onChange={(e) => onImagesChange([e.target.value])}
                    placeholder="Image URL"
                    className="flex-1"
                  />
                </>
              ) : (
                <>
                  <img
                    src={images[0]}
                    alt="Uploaded image"
                    className="w-10 h-10 object-cover rounded border"
                  />
                  <span className="text-sm text-muted-foreground flex-1 truncate">
                    {images[0].split('/').pop()}
                  </span>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onImagesChange([''])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Input
              value=""
              onChange={(e) => onImagesChange([e.target.value])}
              placeholder="Image URL"
            />
          )}
        </div>
      ) : (
        // Multiple images mode
        <div className="space-y-2">
          {images.map((image, index) => (
            <div key={index} className="flex items-center gap-2">
              {image.startsWith('http') ? (
                // URL input
                <div className="flex-1 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  <Input
                    value={image}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="Image URL"
                    className="flex-1"
                  />
                </div>
              ) : image ? (
                // Uploaded image preview
                <div className="flex-1 flex items-center gap-2">
                  <img
                    src={image}
                    alt={`Image ${index + 1}`}
                    className="w-10 h-10 object-cover rounded border"
                  />
                  <span className="text-sm text-muted-foreground flex-1 truncate">
                    {image.split('/').pop()}
                  </span>
                </div>
              ) : (
                // Empty URL input
                <Input
                  value={image}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="Image URL"
                  className="flex-1"
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};