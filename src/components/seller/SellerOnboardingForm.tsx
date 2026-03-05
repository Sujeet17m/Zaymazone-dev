import { useState, useEffect } from 'react';
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/ImageUpload';
import { VideoUpload } from '@/components/VideoUpload';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { 
  User, 
  Building, 
  Package, 
  Truck, 
  FileText, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface OnboardingData {
  name: string;
  bio: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  avatar: string;
  coverImage: string;
  specialties: string[];
  experience: number;
  socials: {
    instagram: string;
    facebook: string;
    website: string;
  };
  businessInfo: {
    businessName: string;
    sellerType: 'gst' | 'non-gst' | '';
    gstNumber: string;
    panNumber: string;
    aadhaarNumber: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    contact: {
      email: string;
      phone: string;
      address: {
        village: string;
        district: string;
        state: string;
        pincode: string;
      };
    };
  };
  productInfo: {
    description: string;
    materials: string;
    priceRange: {
      min: number;
      max: number;
    };
    stockQuantity: number;
    photos: string[];
  };
  logistics: {
    pickupAddress: {
      sameAsMain: boolean;
      address: string;
    };
    dispatchTime: string;
    packagingType: string;
  };
  documents: {
    gstCertificate: string;
    aadhaarProof: string;
    craftVideo: string;
  };
  payment: {
    upiId: string;
    paymentFrequency: string;
  };
}

const INITIAL_DATA: OnboardingData = {
  name: '',
  bio: '',
  location: { city: '', state: '', country: 'India' },
  avatar: '',
  coverImage: '',
  specialties: [],
  experience: 0,
  socials: { instagram: '', facebook: '', website: '' },
  businessInfo: {
    businessName: '',
    sellerType: '',
    gstNumber: '',
    panNumber: '',
    aadhaarNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    contact: {
      email: '',
      phone: '',
      address: { village: '', district: '', state: '', pincode: '' }
    }
  },
  productInfo: {
    description: '',
    materials: '',
    priceRange: { min: 0, max: 0 },
    stockQuantity: 0,
    photos: []
  },
  logistics: {
    pickupAddress: { sameAsMain: true, address: '' },
    dispatchTime: '',
    packagingType: ''
  },
  documents: {
    gstCertificate: '',
    aadhaarProof: '',
    craftVideo: ''
  },
  payment: {
    upiId: '',
    paymentFrequency: ''
  }
};

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User, description: 'Tell us about yourself' },
  { id: 2, title: 'Business Details', icon: Building, description: 'Business information' },
  { id: 3, title: 'Product Information', icon: Package, description: 'Your craft details' },
  { id: 4, title: 'Logistics', icon: Truck, description: 'Shipping and delivery' },
  { id: 5, title: 'Documents', icon: FileText, description: 'Required documents' },
  { id: 6, title: 'Payment', icon: CreditCard, description: 'Payment setup' }
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const CRAFT_SPECIALTIES = [
  'Pottery', 'Textiles', 'Jewelry', 'Woodworking', 'Metalwork', 'Painting',
  'Sculpture', 'Embroidery', 'Weaving', 'Leather Work', 'Paper Craft', 'Other'
];

// Helper function to convert base64 to File
const base64ToFile = async (base64String: string, filename: string): Promise<File> => {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:[^;]+;base64,/, '');
  
  // Convert base64 to blob
  const response = await fetch(`data:application/octet-stream;base64,${base64Data}`);
  const blob = await response.blob();
  
  // Create file from blob
  return new File([blob], filename, { type: blob.type });
};

export function SellerOnboardingForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkApplicationStatus();
  }, []);

  const checkApplicationStatus = async () => {
    try {
      const token = localStorage.getItem('firebase_id_token');
      const response = await fetch('/api/seller/onboarding/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.status !== 'not_submitted') {
        setApplicationStatus(data.status);
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const updateFormData = (field: keyof OnboardingData, value: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedFormData = (section: keyof OnboardingData, field: string, value: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        [field]: value
      }
    }));
  };

  const updateDoubleNestedFormData = (section: keyof OnboardingData, subsection: string, field: string, value: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any), // eslint-disable-line @typescript-eslint/no-explicit-any
        [subsection]: {
          ...((prev[section] as any)[subsection] || {}), // eslint-disable-line @typescript-eslint/no-explicit-any
          [field]: value
        }
      }
    }));
  };

  const handleSpecialtyChange = (specialty: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      specialties: checked 
        ? [...prev.specialties, specialty]
        : prev.specialties.filter(s => s !== specialty)
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.name && formData.location.city && formData.location.state);
      case 2: {
        const hasBasicBusiness = !!(formData.businessInfo.businessName && 
                                   formData.businessInfo.contact.email && 
                                   formData.businessInfo.contact.phone);
        const hasValidPAN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.businessInfo.panNumber);
        const hasValidAadhaar = /^\d{12}$/.test(formData.businessInfo.aadhaarNumber);
        const hasValidGST = formData.businessInfo.sellerType !== 'gst' || 
                           (formData.businessInfo.gstNumber ? 
                            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.businessInfo.gstNumber.toUpperCase()) : 
                            false);
        return hasBasicBusiness && hasValidPAN && hasValidAadhaar && hasValidGST;
      }
      case 3:
        return !!(formData.productInfo.description && formData.productInfo.materials && formData.specialties.length > 0);
      case 4:
        return !!(formData.logistics.dispatchTime && formData.logistics.packagingType);
      case 5: {
        const hasAadhaarProof = !!formData.documents.aadhaarProof;
        const hasGSTProof = formData.businessInfo.sellerType !== 'gst' || !!formData.documents.gstCertificate;
        return hasAadhaarProof && hasGSTProof;
      }
      case 6: {
        // Use regex-only validation for bank details
        const hasValidAccount = formData.businessInfo.accountNumber ? /^\d{9,18}$/.test(formData.businessInfo.accountNumber) : true;
        const hasValidIFSC = formData.businessInfo.ifscCode ? /^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.businessInfo.ifscCode) : true;
        const hasUPI = !!formData.payment.upiId;
        return hasValidAccount && hasValidIFSC && hasUPI;
      }
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please fill all required fields',
        variant: 'destructive'
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const submitApplication = async () => {
    if (!validateStep(6)) {
      toast({
        title: 'Validation Error',
        description: 'Please complete all required fields',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create FormData for file uploads
      const formDataToSend = new FormData();

      // Add basic info
      formDataToSend.append('businessName', formData.businessInfo.businessName);
      formDataToSend.append('ownerName', formData.name);
      formDataToSend.append('email', formData.businessInfo.contact.email);
      formDataToSend.append('phone', formData.businessInfo.contact.phone);
      formDataToSend.append('address', JSON.stringify(formData.businessInfo.contact.address));

      // Add experience & type
      formDataToSend.append('yearsOfExperience', formData.experience.toString());
      formDataToSend.append('sellerType', formData.businessInfo.sellerType);
      if (formData.businessInfo.gstNumber) {
        formDataToSend.append('gstNumber', formData.businessInfo.gstNumber);
      }
      formDataToSend.append('aadhaarNumber', formData.businessInfo.aadhaarNumber || '');
      formDataToSend.append('panNumber', formData.businessInfo.panNumber);

      // Add product details
      formDataToSend.append('categories', JSON.stringify(formData.specialties));
      formDataToSend.append('productDescription', formData.productInfo.description);
      formDataToSend.append('materials', formData.productInfo.materials);
      formDataToSend.append('priceRange', JSON.stringify(formData.productInfo.priceRange));
      formDataToSend.append('stockQuantity', formData.productInfo.stockQuantity.toString());

      // Add logistics
      formDataToSend.append('pickupAddress', JSON.stringify(formData.logistics.pickupAddress));
      formDataToSend.append('dispatchTime', formData.logistics.dispatchTime);
      formDataToSend.append('packagingType', formData.logistics.packagingType);

      // Add bank details
      formDataToSend.append('bankName', formData.businessInfo.bankName || '');
      formDataToSend.append('accountNumber', formData.businessInfo.accountNumber || '');
      formDataToSend.append('ifscCode', formData.businessInfo.ifscCode || '');
      if (formData.payment.upiId) {
        formDataToSend.append('upiId', formData.payment.upiId);
      }
      formDataToSend.append('paymentFrequency', formData.payment.paymentFrequency);

      // Add story
      if (formData.bio) {
        formDataToSend.append('story', formData.bio);
      }

      // Add files
      if (formData.avatar) {
        // Convert base64 to file if needed
        const avatarFile = await base64ToFile(formData.avatar, 'profile-photo.jpg');
        formDataToSend.append('profilePhoto', avatarFile);
      }

      if (formData.productInfo.photos && formData.productInfo.photos.length > 0) {
        for (let i = 0; i < formData.productInfo.photos.length; i++) {
          const photoFile = await base64ToFile(formData.productInfo.photos[i], `product-photo-${i + 1}.jpg`);
          formDataToSend.append('productPhotos', photoFile);
        }
      }

      if (formData.documents.gstCertificate) {
        const gstFile = await base64ToFile(formData.documents.gstCertificate, 'gst-certificate.pdf');
        formDataToSend.append('gstCertificate', gstFile);
      }

      if (formData.documents.aadhaarProof) {
        const aadhaarFile = await base64ToFile(formData.documents.aadhaarProof, 'aadhaar-proof.pdf');
        formDataToSend.append('aadhaarProof', aadhaarFile);
      }

      // craftVideo is already a URL (uploaded by VideoUpload component) — append as plain text
      if (formData.documents.craftVideo) {
        formDataToSend.append('craftVideoUrl', formData.documents.craftVideo);
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/seller-onboarding`, {
        method: 'POST',
        body: formDataToSend
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Application Submitted!',
          description: 'Your application is under review. You will be notified once approved.'
        });
        setApplicationStatus('pending');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
      }
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Show status if application already submitted
  if (applicationStatus) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {applicationStatus === 'pending' && <Clock className="w-16 h-16 text-yellow-500" />}
                {applicationStatus === 'approved' && <CheckCircle className="w-16 h-16 text-green-500" />}
                {applicationStatus === 'rejected' && <AlertCircle className="w-16 h-16 text-red-500" />}
              </div>
              <CardTitle className="text-2xl">
                Application {applicationStatus === 'approved' ? 'Approved' : 
                           applicationStatus === 'rejected' ? 'Rejected' : 'Under Review'}
              </CardTitle>
              <CardDescription>
                {applicationStatus === 'pending' && 'Your seller application is being reviewed by our team.'}
                {applicationStatus === 'approved' && 'Congratulations! You can now start selling on Zaymazone.'}
                {applicationStatus === 'rejected' && 'Your application was not approved. Please contact support for details.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Badge variant={
                applicationStatus === 'approved' ? 'default' :
                applicationStatus === 'rejected' ? 'destructive' : 'secondary'
              }>
                {applicationStatus.toUpperCase()}
              </Badge>
              {applicationStatus === 'approved' && (
                <div className="mt-6">
                  <Button onClick={() => window.location.href = '/seller/shop'}>
                    Go to Shop Management
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Become a Seller</h1>
          <p className="text-muted-foreground">Join Zaymazone and showcase your crafts to the world</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                  ${currentStep >= step.id ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <span className="text-xs mt-1 text-center">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(STEPS[currentStep - 1].icon, { className: "w-5 h-5" })}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">About You</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => updateFormData('bio', e.target.value)}
                    placeholder="Tell us about yourself and your craft journey"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.location.city}
                      onChange={(e) => updateNestedFormData('location', 'city', e.target.value)}
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.location.state}
                      onValueChange={(value) => updateNestedFormData('location', 'state', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Profile Photo</Label>
                  <ImageUpload
                    images={formData.avatar ? [formData.avatar] : []}
                    onImagesChange={(images) => updateFormData('avatar', images[0] || '')}
                    maxImages={1}
                    singleMode={true}
                    category="artisans"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Business Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessInfo.businessName}
                    onChange={(e) => updateNestedFormData('businessInfo', 'businessName', e.target.value)}
                    placeholder="Enter your business name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.businessInfo.contact.email}
                    onChange={(e) => updateDoubleNestedFormData('businessInfo', 'contact', 'email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.businessInfo.contact.phone}
                    onChange={(e) => updateDoubleNestedFormData('businessInfo', 'contact', 'phone', e.target.value)}
                    placeholder="10-digit phone number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="village">Village/Town</Label>
                    <Input
                      id="village"
                      value={formData.businessInfo.contact.address.village}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        businessInfo: {
                          ...prev.businessInfo,
                          contact: {
                            ...prev.businessInfo.contact,
                            address: {
                              ...prev.businessInfo.contact.address,
                              village: e.target.value
                            }
                          }
                        }
                      }))}
                      placeholder="Enter village/town"
                    />
                  </div>
                  <div>
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      value={formData.businessInfo.contact.address.district}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        businessInfo: {
                          ...prev.businessInfo,
                          contact: {
                            ...prev.businessInfo.contact,
                            address: {
                              ...prev.businessInfo.contact.address,
                              district: e.target.value
                            }
                          }
                        }
                      }))}
                      placeholder="Enter district"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="addressState">State</Label>
                    <Select
                      value={formData.businessInfo.contact.address.state}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        businessInfo: {
                          ...prev.businessInfo,
                          contact: {
                            ...prev.businessInfo.contact,
                            address: {
                              ...prev.businessInfo.contact.address,
                              state: value
                            }
                          }
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.businessInfo.contact.address.pincode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        businessInfo: {
                          ...prev.businessInfo,
                          contact: {
                            ...prev.businessInfo.contact,
                            address: {
                              ...prev.businessInfo.contact.address,
                              pincode: e.target.value
                            }
                          }
                        }
                      }))}
                      placeholder="6-digit pincode"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="experience">Years of Experience</Label>
                  <Input
                    id="experience"
                    type="number"
                    value={formData.experience}
                    onChange={(e) => updateFormData('experience', parseInt(e.target.value) || 0)}
                    placeholder="Enter years of experience"
                  />
                </div>
                <div>
                  <Label>Seller Type</Label>
                  <Select
                    value={formData.businessInfo.sellerType}
                    onValueChange={(value) => updateNestedFormData('businessInfo', 'sellerType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select seller type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gst">GST Registered</SelectItem>
                      <SelectItem value="non-gst">Non-GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.businessInfo.sellerType === 'gst' && (
                  <div>
                    <Label htmlFor="gstNumber">GST Number</Label>
                    <Input
                      id="gstNumber"
                      value={formData.businessInfo.gstNumber}
                      onChange={(e) => updateNestedFormData('businessInfo', 'gstNumber', e.target.value)}
                      placeholder="Enter GST number"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="panNumber">PAN Number *</Label>
                  <Input
                    id="panNumber"
                    value={formData.businessInfo.panNumber}
                    onChange={(e) => updateNestedFormData('businessInfo', 'panNumber', e.target.value)}
                    placeholder="Enter PAN number (ABCDE1234F)"
                  />
                </div>
                <div>
                  <Label htmlFor="aadhaarNumber">Aadhaar Number *</Label>
                  <Input
                    id="aadhaarNumber"
                    value={formData.businessInfo.aadhaarNumber}
                    onChange={(e) => updateNestedFormData('businessInfo', 'aadhaarNumber', e.target.value)}
                    placeholder="12-digit Aadhaar number"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Product Information */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Craft Specialties *</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {CRAFT_SPECIALTIES.map((specialty) => (
                      <div key={specialty} className="flex items-center space-x-2">
                        <Checkbox
                          id={specialty}
                          checked={formData.specialties.includes(specialty)}
                          onCheckedChange={(checked) => handleSpecialtyChange(specialty, checked as boolean)}
                        />
                        <Label htmlFor={specialty} className="text-sm">{specialty}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="productDescription">Product Description *</Label>
                  <Textarea
                    id="productDescription"
                    value={formData.productInfo.description}
                    onChange={(e) => updateNestedFormData('productInfo', 'description', e.target.value)}
                    placeholder="Describe your products and craftsmanship"
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="materials">Materials Used *</Label>
                  <Textarea
                    id="materials"
                    value={formData.productInfo.materials}
                    onChange={(e) => updateNestedFormData('productInfo', 'materials', e.target.value)}
                    placeholder="List materials and techniques used"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minPrice">Minimum Price (₹)</Label>
                    <Input
                      id="minPrice"
                      type="number"
                      min="0"
                      value={formData.productInfo.priceRange.min}
                      onChange={(e) => updateDoubleNestedFormData('productInfo', 'priceRange', 'min', Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="Min price"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPrice">Maximum Price (₹)</Label>
                    <Input
                      id="maxPrice"
                      type="number"
                      min="0"
                      value={formData.productInfo.priceRange.max}
                      onChange={(e) => updateDoubleNestedFormData('productInfo', 'priceRange', 'max', Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="Max price"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="stockQuantity">Stock Quantity</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    value={formData.productInfo.stockQuantity}
                    onChange={(e) => updateNestedFormData('productInfo', 'stockQuantity', parseInt(e.target.value) || 0)}
                    placeholder="Current stock quantity"
                  />
                </div>
                <div>
                  <Label>Product Photos</Label>
                  <ImageUpload
                    images={formData.productInfo.photos}
                    onImagesChange={(images) => updateNestedFormData('productInfo', 'photos', images)}
                    maxImages={10}
                    category="products"
                  />
                  {formData.productInfo.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {formData.productInfo.photos.map((photo, index) => (
                        <img key={index} src={photo} alt={`Product ${index + 1}`} className="w-16 h-16 object-cover rounded" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Logistics */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="dispatchTime">Dispatch Time *</Label>
                  <Select
                    value={formData.logistics.dispatchTime}
                    onValueChange={(value) => updateNestedFormData('logistics', 'dispatchTime', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dispatch time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2 days">1-2 days</SelectItem>
                      <SelectItem value="3-5 days">3-5 days</SelectItem>
                      <SelectItem value="1 week">1 week</SelectItem>
                      <SelectItem value="2 weeks">2 weeks</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="packagingType">Packaging Type *</Label>
                  <Select
                    value={formData.logistics.packagingType}
                    onValueChange={(value) => updateNestedFormData('logistics', 'packagingType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select packaging type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Eco-friendly">Eco-friendly</SelectItem>
                      <SelectItem value="Traditional">Traditional</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameAddress"
                      checked={formData.logistics.pickupAddress.sameAsMain}
                      onCheckedChange={(checked) => updateDoubleNestedFormData('logistics', 'pickupAddress', 'sameAsMain', checked)}
                    />
                    <Label htmlFor="sameAddress">Pickup address same as main address</Label>
                  </div>
                </div>
                {!formData.logistics.pickupAddress.sameAsMain && (
                  <div>
                    <Label htmlFor="pickupAddress">Pickup Address</Label>
                    <Textarea
                      id="pickupAddress"
                      value={formData.logistics.pickupAddress.address}
                      onChange={(e) => updateDoubleNestedFormData('logistics', 'pickupAddress', 'address', e.target.value)}
                      placeholder="Enter pickup address"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Documents */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <div>
                  <Label>GST Certificate {formData.businessInfo.sellerType === 'gst' && '*'}</Label>
                  <ImageUpload
                    images={formData.documents.gstCertificate ? [formData.documents.gstCertificate] : []}
                    onImagesChange={(images) => updateNestedFormData('documents', 'gstCertificate', images[0] || '')}
                    maxImages={1}
                    singleMode={true}
                    category="documents"
                    fileType="document"
                  />
                </div>
                <div>
                  <Label>Aadhaar Proof *</Label>
                  <ImageUpload
                    images={formData.documents.aadhaarProof ? [formData.documents.aadhaarProof] : []}
                    onImagesChange={(images) => updateNestedFormData('documents', 'aadhaarProof', images[0] || '')}
                    maxImages={1}
                    singleMode={true}
                    category="documents"
                    fileType="document"
                  />
                </div>
                <div>
                  <Label>Craft Video</Label>
                  <VideoUpload
                    value={formData.documents.craftVideo}
                    onChange={(url) => updateNestedFormData('documents', 'craftVideo', url)}
                  />
                </div>
              </div>
            )}

            {/* Step 6: Payment */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.businessInfo.bankName}
                    onChange={(e) => updateNestedFormData('businessInfo', 'bankName', e.target.value)}
                    placeholder="Enter bank name"
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={formData.businessInfo.accountNumber}
                    onChange={(e) => updateNestedFormData('businessInfo', 'accountNumber', e.target.value)}
                    placeholder="Enter account number (9-18 digits)"
                  />
                </div>
                <div>
                  <Label htmlFor="ifscCode">IFSC Code</Label>
                  <Input
                    id="ifscCode"
                    value={formData.businessInfo.ifscCode}
                    onChange={(e) => updateNestedFormData('businessInfo', 'ifscCode', e.target.value)}
                    placeholder="Enter IFSC code (e.g., SBIN0001234)"
                  />
                </div>
                <div>
                  <Label htmlFor="upiId">UPI ID *</Label>
                  <Input
                    id="upiId"
                    value={formData.payment.upiId}
                    onChange={(e) => updateNestedFormData('payment', 'upiId', e.target.value)}
                    placeholder="Enter UPI ID (e.g., user@paytm)"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentFrequency">Payment Frequency</Label>
                  <Select
                    value={formData.payment.paymentFrequency}
                    onValueChange={(value) => updateNestedFormData('payment', 'paymentFrequency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  onClick={nextStep}
                  className="flex items-center gap-2"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={submitApplication}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}