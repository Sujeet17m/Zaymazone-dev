import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi, SellerFormData } from "@/services/api";
import { useFormValidation } from "@/hooks/use-form-validation";
import { VideoUpload } from "@/components/VideoUpload";
import { Loader2 } from "lucide-react";

import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { AuthDebugPanel } from "@/components/AuthDebugPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Globe, 
  TrendingUp, 
  Users, 
  Star, 
  Upload, 
  Camera, 
  FileText, 
  CreditCard, 
  Award,
  BarChart3,
  Package,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SellerOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailConflictError, setEmailConflictError] = useState('');

  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: {
      village: "",
      district: "",
      state: "",
      pincode: ""
    },
    yearsOfExperience: "",
    profilePhoto: null as File | null,
    productPhotos: [] as File[],

    // Step 2: Seller Type & Verification
    sellerType: "", // "gst" or "non-gst"
    gstNumber: "",
    gstCertificate: null as File | null,
    aadhaarNumber: "",
    aadhaarProof: null as File | null,
    panNumber: "",
    
    // Step 3: Product Details
    categories: [] as string[],
    productDescription: "",
    materials: "",
    priceRange: {
      min: "",
      max: ""
    },
    stockQuantity: "",
    
    // Step 4: Shipping & Delivery
    pickupAddress: {
      sameAsMain: true,
      address: ""
    },
    dispatchTime: "",
    packagingType: "",
    
    // Step 5: Bank Details
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
    paymentFrequency: "",
    
    // Step 6: Seller Story
    story: "",
    craftVideo: "" as string
  });

  const { errors, validateStep } = useFormValidation(formData);

  // File upload handlers
  const handleFileUpload = (file: File, type: 'image' | 'document' | 'video', maxSize: number) => {
    if (!file) return null;

    // Check file size (in MB)
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please upload a file less than ${maxSize}MB`,
        variant: "destructive"
      });
      return null;
    }

    // Validate file type
    const validTypes = {
      image: ['image/jpeg', 'image/png', 'image/jpg'],
      document: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
      video: ['video/mp4', 'video/quicktime']
    };

    if (!validTypes[type].includes(file.type)) {
      let allowedTypes = '';
      switch (type) {
        case 'document':
          allowedTypes = 'PDF, JPG, or PNG';
          break;
        case 'image':
          allowedTypes = 'JPG or PNG';
          break;
        case 'video':
          allowedTypes = 'MP4 or MOV';
          break;
      }
      
      toast({
        title: "Invalid file type",
        description: `Please upload a ${allowedTypes} file`,
        variant: "destructive"
      });
      return null;
    }

    // Additional validation for PDFs
    if (type === 'document' && file.type === 'application/pdf') {
      // Check if PDF is valid (you might want to add more validation)
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast({
          title: "Invalid PDF",
          description: "Please upload a valid PDF file",
          variant: "destructive"
        });
        return null;
      }
    }

    return file;
  };

  const getFilePreview = (file: File) => {
    if (file.type === 'application/pdf') {
      return URL.createObjectURL(file);
    } else if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, type: 'image' | 'document' | 'video', maxSize: number = 5) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      const validatedFile = handleFileUpload(file, type, maxSize);
      if (validatedFile) {
        // Show loading toast for large files
        if (file.size > 1024 * 1024) { // If file is larger than 1MB
          toast({
            title: "Processing file",
            description: "Please wait while we process your file..."
          });
        }

        // Additional validation for PDFs
        if (type === 'document' && file.type === 'application/pdf') {
          // You might want to add PDF validation here
          // For example, checking if the PDF is not corrupted
          const reader = new FileReader();
          reader.onload = () => {
            setFormData(prev => ({
              ...prev,
              [fieldName]: validatedFile
            }));
            toast({
              title: "File uploaded",
              description: `${file.name} has been successfully uploaded`,
              variant: "default"
            });
          };
          reader.onerror = () => {
            toast({
              title: "Error",
              description: "Failed to read the PDF file. Please try again.",
              variant: "destructive"
            });
          };
          reader.readAsArrayBuffer(file);
        } else {
          setFormData(prev => ({
            ...prev,
            [fieldName]: validatedFile
          }));
          toast({
            title: "File uploaded",
            description: `${file.name} has been successfully uploaded`,
            variant: "default"
          });
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive"
      });
    }

    // Reset the input value to allow uploading the same file again
    e.target.value = '';
  };

  const handleMultipleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string, type: 'image' | 'document' | 'video', maxFiles: number = 5, maxSize: number = 5) => {
    const files = Array.from(e.target.files || []);
    if (files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Please upload a maximum of ${maxFiles} files`,
        variant: "destructive"
      });
      return;
    }

    const validFiles = files
      .map(file => handleFileUpload(file, type, maxSize))
      .filter((file): file is File => file !== null);

    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        [fieldName]: validFiles
      }));
    }
  };

  const totalSteps = 6;
  const progress = (currentStep / totalSteps) * 100;

  const productCategories = [
    "Handicrafts",
    "Paintings",
    "Textiles / Embroidery",
    "Clay / Pottery",
    "Wooden Toys",
    "Metal / Brass Works",
    "Home Decor",
    "Others"
  ];

  const dispatchTimeOptions = [
    { value: "1-2", label: "1-2 days" },
    { value: "3-5", label: "3-5 days" },
    { value: "5+", label: "More than 5 days" }
  ];

  const packagingOptions = [
    { value: "eco", label: "Eco-friendly" },
    { value: "standard", label: "Standard box" },
    { value: "custom", label: "Custom packaging" }
  ];

  const paymentFrequencyOptions = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" }
  ];

  const benefits = [
    {
      icon: Globe,
      title: "Pan-India Reach",
      description: "Connect with customers across India and internationally"
    },
    {
      icon: TrendingUp,
      title: "Fair Pricing",
      description: "Get the best value for your authentic handcrafted items"
    },
    {
      icon: Users,
      title: "Artisan Community",
      description: "Network with fellow craftspeople and share experiences"
    },
    {
      icon: Star,
      title: "Traditional Recognition",
      description: "Showcase your heritage and craftsmanship"
    }
  ];

  const dashboardFeatures = [
    { icon: BarChart3, title: "Sales Dashboard", desc: "Track orders and earnings" },
    { icon: Package, title: "Easy Shipping", desc: "Doorstep pickup service" },
    { icon: MessageSquare, title: "Customer Connect", desc: "Direct customer support" },
    { icon: Award, title: "Master Artisan", desc: "Earn craft excellence badges" }
  ];

  // Called on email blur and before step-1 advancement.
  // Returns true if a conflict was found (blocks advancement).
  const checkEmailExists = async (email: string): Promise<boolean> => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    try {
      const result = await sellerApi.checkEmail(email);
      if (result.existsAsCustomer && result.existsAsArtisan) {
        setEmailConflictError('This email is already registered. Please use a different email.');
        return true;
      } else if (result.existsAsCustomer) {
        setEmailConflictError('This email is already registered as a customer account. Please use a different email.');
        return true;
      } else if (result.existsAsArtisan) {
        setEmailConflictError('This email is already registered as an artisan account. Please use a different email.');
        return true;
      } else {
        setEmailConflictError('');
        return false;
      }
    } catch {
      // Network failure — silently ignore
      return false;
    }
  };

  const handleEmailBlur = async () => {
    await checkEmailExists(formData.email);
  };

  const handleNext = async () => {
    if (validateStep(currentStep)) {
      // Step 1 — async cross-account email uniqueness check
      if (currentStep === 1) {
        setIsLoading(true);
        const hasConflict = await checkEmailExists(formData.email);
        setIsLoading(false);
        if (hasConflict) return;
      }

      // Special validations for specific steps
      if (currentStep === 2 && formData.sellerType === 'gst') {
        setIsLoading(true);
        try {
          await sellerApi.verifyGST(formData.gstNumber);
          setCurrentStep(currentStep + 1);
        } catch (error) {
          toast({
            title: "GST Verification Failed",
            description: error instanceof Error ? error.message : "Please check your GST number",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (currentStep === 5) {
        // Skip bank verification - just proceed to next step
        setCurrentStep(currentStep + 1);
        return;
      }

      // Normal step progression
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      // Show error toast for validation failures
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive"
      });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await sellerApi.completeOnboarding(formData);
      toast({
        title: "Application Submitted Successfully!",
        description: "Redirecting to confirmation page...",
      });
      setTimeout(() => {
        navigate('/seller-success');
      }, 1500);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-20 pb-16 bg-gradient-warm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
              Join the Zaymazone Artisan Community
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Turn your passion for traditional crafts into a thriving business. Get access to customers worldwide, 
              fair pricing, and tools to grow your craft legacy.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {benefits.map((benefit, index) => (
              <Card key={index} className="text-center border-muted hover:shadow-elegant transition-shadow">
                <CardContent className="pt-6">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Debug Panel - Remove in production */}
          <AuthDebugPanel />
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-bold">Artisan Registration</h2>
              <Badge variant="outline">Step {currentStep} of {totalSteps}</Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Registration Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle>
                    {currentStep === 1 && "Basic Information"}
                    {currentStep === 2 && "Seller Type & Verification"}
                    {currentStep === 3 && "Product Details"}
                    {currentStep === 4 && "Shipping & Delivery"}
                    {currentStep === 5 && "Banking Information"}
                    {currentStep === 6 && "Your Story"}
                  </CardTitle>
                  <CardDescription>
                    {currentStep === 1 && "Let's start with your basic details"}
                    {currentStep === 2 && "Choose your seller type and verify your identity"}
                    {currentStep === 3 && "Tell us about your products"}
                    {currentStep === 4 && "Set up your shipping preferences"}
                    {currentStep === 5 && "Secure payment setup for your earnings"}
                    {currentStep === 6 && "Share your craft journey"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Step 1: Basic Info */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="businessName">Shop / Brand Name *</Label>
                          <Input
                            id="businessName"
                            name="businessName"
                            autoComplete="organization"
                            value={formData.businessName}
                            onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                            placeholder="e.g., Kashmiri Heritage Crafts"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ownerName">Full Name *</Label>
                          <Input
                            id="ownerName"
                            name="ownerName"
                            autoComplete="name"
                            value={formData.ownerName}
                            onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                            placeholder="Your full name"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="phone">Mobile Number *</Label>
                          <Input
                            id="phone"
                            name="phone"
                            autoComplete="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            placeholder="+91 9876543210"
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email Address *</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={formData.email}
                            onChange={(e) => {
                              setFormData({...formData, email: e.target.value});
                              setEmailConflictError('');
                            }}
                            onBlur={handleEmailBlur}
                            placeholder="your@email.com"
                            required
                            className={emailConflictError || errors.email ? "border-red-500" : ""}
                          />
                          {errors.email && (
                            <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                          )}
                          {emailConflictError && (
                            <p className="text-sm text-red-500 mt-1">{emailConflictError}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="password">Password *</Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            placeholder="Create a strong password (min 6 characters)"
                            required
                            className={errors.password ? "border-red-500" : ""}
                          />
                          {errors.password && (
                            <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            You'll use this password to sign in after admin approval
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword">Re-enter Password *</Label>
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                            placeholder="Re-enter your password"
                            required
                            className={errors.confirmPassword ? "border-red-500" : ""}
                          />
                          {errors.confirmPassword && (
                            <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="village">Village / Town *</Label>
                          <Input
                            id="village"
                            name="village"
                            autoComplete="address-level3"
                            value={formData.address.village}
                            onChange={(e) => setFormData({
                              ...formData,
                              address: { ...formData.address, village: e.target.value }
                            })}
                            placeholder="Enter village or town name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="district">District *</Label>
                          <Input
                            id="district"
                            name="district"
                            autoComplete="address-level2"
                            value={formData.address.district}
                            onChange={(e) => setFormData({
                              ...formData,
                              address: { ...formData.address, district: e.target.value }
                            })}
                            placeholder="Enter district"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="state">State *</Label>
                          <Input
                            id="state"
                            name="state"
                            autoComplete="address-level1"
                            value={formData.address.state}
                            onChange={(e) => setFormData({
                              ...formData,
                              address: { ...formData.address, state: e.target.value }
                            })}
                            placeholder="Enter state"
                          />
                        </div>
                        <div>
                          <Label htmlFor="pincode">Pincode *</Label>
                          <Input
                            id="pincode"
                            name="pincode"
                            autoComplete="postal-code"
                            value={formData.address.pincode}
                            onChange={(e) => setFormData({
                              ...formData,
                              address: { ...formData.address, pincode: e.target.value }
                            })}
                            placeholder="Enter pincode"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="yearsOfExperience">Years of Experience in Craftwork *</Label>
                        <Input
                          id="yearsOfExperience"
                          name="yearsOfExperience"
                          type="number"
                          autoComplete="off"
                          value={formData.yearsOfExperience}
                          onChange={(e) => setFormData({...formData, yearsOfExperience: e.target.value})}
                          placeholder="Enter years of experience"
                        />
                      </div>

                      <div>
                        <Label htmlFor="profilePhoto">Profile Photo</Label>
                        <div
                          className={`border-2 border-dashed ${errors.profilePhoto ? 'border-red-500' : 'border-muted'} rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer`}
                          onClick={() => document.getElementById('profilePhoto')?.click()}
                          role="button"
                          tabIndex={0}
                          aria-label="Upload profile photo"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              document.getElementById('profilePhoto')?.click();
                            }
                          }}
                        >
                          {formData.profilePhoto ? (
                            <div className="flex items-center justify-center">
                              <img
                                src={URL.createObjectURL(formData.profilePhoto)}
                                alt="Profile"
                                className="w-20 h-20 object-cover rounded-full"
                              />
                            </div>
                          ) : (
                            <>
                              <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm font-medium">Upload Profile Photo</p>
                              <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          id="profilePhoto"
                          accept="image/jpeg,image/png,image/jpg"
                          className="hidden"
                          onChange={(e) => handleFileInputChange(e, 'profilePhoto', 'image')}
                          aria-label="Profile photo upload"
                        />
                        {errors.profilePhoto && (
                          <p className="text-sm text-red-500 mt-1">{errors.profilePhoto}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Seller Type & Verification */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-medium mb-2">Choose Your Seller Type</h3>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="non-gst"
                              name="sellerType"
                              value="non-gst"
                              checked={formData.sellerType === "non-gst"}
                              onChange={(e) => setFormData({...formData, sellerType: e.target.value})}
                              className="form-radio"
                              aria-label="Non-GST Seller"
                            />
                            <Label htmlFor="non-gst">
                              <span className="font-medium">Non-GST Seller (Small Artisan)</span>
                              <p className="text-sm text-muted-foreground">Annual turnover below ₹20 lakh (services) / ₹40 lakh (goods)</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="gst"
                              name="sellerType"
                              value="gst"
                              checked={formData.sellerType === "gst"}
                              onChange={(e) => setFormData({...formData, sellerType: e.target.value})}
                              className="form-radio"
                              aria-label="GST-Registered Seller"
                            />
                            <Label htmlFor="gst">
                              <span className="font-medium">GST-Registered Seller</span>
                              <p className="text-sm text-muted-foreground">I have a valid GSTIN</p>
                            </Label>
                          </div>
                        </div>
                      </div>

                      {formData.sellerType === "non-gst" && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="aadhaarNumber">Aadhaar Card Number *</Label>
                            <Input
                              id="aadhaarNumber"
                              value={formData.aadhaarNumber}
                              onChange={(e) => setFormData({...formData, aadhaarNumber: e.target.value})}
                              placeholder="Enter Aadhaar number"
                            />
                          </div>
                          <div>
                            <Label>Aadhaar Card *</Label>
                            <div className="relative mt-2">
                            <div 
                              className={`border-2 border-dashed ${errors.aadhaarProof ? 'border-red-500' : 'border-muted'} rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer`}
                              onClick={() => document.getElementById('aadhaarProof')?.click()}
                              role="button"
                              tabIndex={0}
                              aria-label="Upload Aadhaar card"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  document.getElementById('aadhaarProof')?.click();
                                }
                              }}
                            >
                              {formData.aadhaarProof ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <FileText className="w-6 h-6 text-primary" />
                                  <span className="text-sm font-medium text-primary">
                                    {formData.aadhaarProof.name}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-sm font-medium">Upload Aadhaar Card</p>
                                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5MB</p>
                                </>
                              )}
                            </div>
                            {formData.aadhaarProof && (
                              <button
                                type="button"
                                className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData({ ...formData, aadhaarProof: null });
                                }}
                                aria-label="Remove Aadhaar card"
                              >
                                ×
                              </button>
                            )}
                            </div>
                            <input
                              type="file"
                              id="aadhaarProof"
                              accept="application/pdf,image/jpeg,image/png,image/jpg"
                              className="hidden"
                              onChange={(e) => handleFileInputChange(e, 'aadhaarProof', 'document')}
                              aria-label="Aadhaar card upload"
                            />
                            {errors.aadhaarProof && (
                              <p className="text-sm text-red-500 mt-1">{errors.aadhaarProof}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {formData.sellerType === "gst" && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="gstNumber">GSTIN (15-digit number) *</Label>
                            <Input
                              id="gstNumber"
                              value={formData.gstNumber}
                              onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                              placeholder="Enter GST number"
                            />
                          </div>
                          <div>
                            <Label>GST Certificate *</Label>
                            <div className="relative mt-2">
                            <div 
                              className={`border-2 border-dashed ${errors.gstCertificate ? 'border-red-500' : 'border-muted'} rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer`}
                              onClick={() => document.getElementById('gstCertificate')?.click()}
                              role="button"
                              tabIndex={0}
                              aria-label="Upload GST certificate"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  document.getElementById('gstCertificate')?.click();
                                }
                              }}
                            >
                              {formData.gstCertificate ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <FileText className="w-6 h-6 text-primary" />
                                  <span className="text-sm font-medium text-primary">
                                    {formData.gstCertificate.name}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-sm font-medium">Upload GST Certificate</p>
                                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 5MB</p>
                                </>
                              )}
                            </div>
                            {formData.gstCertificate && (
                              <button
                                type="button"
                                className="absolute top-2 right-2 p-1 hover:bg-red-100 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData({ ...formData, gstCertificate: null });
                                }}
                                aria-label="Remove GST certificate"
                              >
                                ×
                              </button>
                            )}
                            </div>
                            <input
                              type="file"
                              id="gstCertificate"
                              accept="application/pdf,image/jpeg,image/png,image/jpg"
                              className="hidden"
                              onChange={(e) => handleFileInputChange(e, 'gstCertificate', 'document')}
                              aria-label="GST certificate upload"
                            />
                            {errors.gstCertificate && (
                              <p className="text-sm text-red-500 mt-1">{errors.gstCertificate}</p>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="panNumber">PAN Number *</Label>
                        <Input
                          id="panNumber"
                          value={formData.panNumber}
                          onChange={(e) => setFormData({...formData, panNumber: e.target.value})}
                          placeholder="Enter PAN number"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Product Details */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <Label>Product Categories *</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {productCategories.map((category) => (
                            <label key={category} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.categories.includes(category)}
                                onChange={(e) => {
                                  const newCategories = e.target.checked
                                    ? [...formData.categories, category]
                                    : formData.categories.filter(c => c !== category);
                                  setFormData({...formData, categories: newCategories});
                                }}
                                className="form-checkbox"
                              />
                              <span className="text-sm">{category}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="productDescription">Describe Your Products *</Label>
                        <Textarea
                          id="productDescription"
                          value={formData.productDescription}
                          onChange={(e) => setFormData({...formData, productDescription: e.target.value})}
                          placeholder="Materials used, uniqueness, traditional techniques..."
                          rows={4}
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="minPrice">Minimum Price (₹) *</Label>
                          <Input
                            id="minPrice"
                            type="number"
                            value={formData.priceRange.min}
                            onChange={(e) => setFormData({
                              ...formData,
                              priceRange: { ...formData.priceRange, min: e.target.value }
                            })}
                            placeholder="Minimum price"
                          />
                        </div>
                        <div>
                          <Label htmlFor="maxPrice">Maximum Price (₹) *</Label>
                          <Input
                            id="maxPrice"
                            type="number"
                            value={formData.priceRange.max}
                            onChange={(e) => setFormData({
                              ...formData,
                              priceRange: { ...formData.priceRange, max: e.target.value }
                            })}
                            placeholder="Maximum price"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="stockQuantity">Available Stock Quantity *</Label>
                        <Input
                          id="stockQuantity"
                          type="number"
                          value={formData.stockQuantity}
                          onChange={(e) => setFormData({...formData, stockQuantity: e.target.value})}
                          placeholder="Enter available stock quantity"
                        />
                      </div>

                      <div className="space-y-4">
                        <Label>Product Photos (Upload up to 4 photos) *</Label>
                        <div className="grid md:grid-cols-2 gap-4">
                          {[0, 1, 2, 3].map((index) => {
                            const hasImage = formData.productPhotos[index];
                            return (
                              <label 
                                key={index} 
                                htmlFor={`productPhoto-${index}`}
                                className={`relative block border-2 border-dashed ${errors.productPhotos ? 'border-red-500' : 'border-muted'} rounded-lg p-4 hover:border-primary transition-colors cursor-pointer`}
                              >
                                {hasImage ? (
                                  <div className="relative aspect-square">
                                    <img
                                      src={URL.createObjectURL(formData.productPhotos[index])}
                                      alt={`Product ${index + 1}`}
                                      className="w-full h-full object-contain rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const newPhotos = [...formData.productPhotos];
                                        newPhotos.splice(index, 1);
                                        setFormData({ ...formData, productPhotos: newPhotos });
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    className="aspect-square flex flex-col items-center justify-center"
                                  >
                                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium">Upload Product {index + 1}</p>
                                    <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                                  </div>
                                )}
                                <input
                                  type="file"
                                  id={`productPhoto-${index}`}
                                  accept="image/jpeg,image/png,image/jpg"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const validatedFile = handleFileUpload(file, 'image', 5);
                                      if (validatedFile) {
                                        const newPhotos = [...formData.productPhotos];
                                        newPhotos[index] = validatedFile;
                                        setFormData({ ...formData, productPhotos: newPhotos });
                                        toast({
                                          title: "Image uploaded",
                                          description: `Product photo ${index + 1} has been added`,
                                        });
                                      }
                                    }
                                    // Reset input
                                    e.target.value = '';
                                  }}
                                  aria-label={`Product photo ${index + 1} upload`}
                                />
                              </label>
                            );
                          })}
                        </div>
                        {errors.productPhotos && (
                          <p className="text-sm text-red-500 mt-2">{errors.productPhotos}</p>
                        )}
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                          <h4 className="font-medium mb-2">Photo Guidelines</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Use clear, well-lit photos</li>
                            <li>• Show product from multiple angles</li>
                            <li>• Include size reference when possible</li>
                            <li>• Highlight unique craft details</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Shipping & Delivery */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center space-x-2 mb-4">
                          <input
                            type="checkbox"
                            id="sameAddress"
                            checked={formData.pickupAddress.sameAsMain}
                            onChange={(e) => setFormData({
                              ...formData,
                              pickupAddress: { ...formData.pickupAddress, sameAsMain: e.target.checked }
                            })}
                            className="form-checkbox"
                            aria-label="Pickup address same as main address"
                          />
                          <Label htmlFor="sameAddress">Pickup address same as main address</Label>
                        </div>
                        
                        {!formData.pickupAddress.sameAsMain && (
                          <div>
                            <Label htmlFor="pickupAddress">Pickup Address *</Label>
                            <Textarea
                              id="pickupAddress"
                              value={formData.pickupAddress.address}
                              onChange={(e) => setFormData({
                                ...formData,
                                pickupAddress: { ...formData.pickupAddress, address: e.target.value }
                              })}
                              placeholder="Enter complete pickup address"
                              rows={4}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <Label>Average Dispatch Time *</Label>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          {dispatchTimeOptions.map(option => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id={`dispatch-${option.value}`}
                                name="dispatchTime"
                                value={option.value}
                                checked={formData.dispatchTime === option.value}
                                onChange={(e) => setFormData({...formData, dispatchTime: e.target.value})}
                                className="form-radio"
                                aria-label={option.label}
                              />
                              <Label htmlFor={`dispatch-${option.value}`}>{option.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label>Packaging Type *</Label>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          {packagingOptions.map(option => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id={`packaging-${option.value}`}
                                name="packagingType"
                                value={option.value}
                                checked={formData.packagingType === option.value}
                                onChange={(e) => setFormData({...formData, packagingType: e.target.value})}
                                className="form-radio"
                                aria-label={option.label}
                              />
                              <Label htmlFor={`packaging-${option.value}`}>{option.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Step 5: Banking Information */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-medium mb-2">Bank Account Details</h3>
                        <p className="text-sm text-muted-foreground">
                          Provide your bank details for receiving payments. This information is kept secure and encrypted.
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="bankName">Bank Name *</Label>
                          <Input
                            id="bankName"
                            value={formData.bankName}
                            onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                            placeholder="e.g., State Bank of India"
                            className={errors.bankName ? "border-red-500" : ""}
                          />
                          {errors.bankName && (
                            <p className="text-sm text-red-500 mt-1">{errors.bankName}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="accountNumber">Account Number *</Label>
                          <Input
                            id="accountNumber"
                            type="text"
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                            placeholder="Enter your account number"
                            className={errors.accountNumber ? "border-red-500" : ""}
                          />
                          {errors.accountNumber && (
                            <p className="text-sm text-red-500 mt-1">{errors.accountNumber}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="ifscCode">IFSC Code *</Label>
                          <Input
                            id="ifscCode"
                            value={formData.ifscCode}
                            onChange={(e) => setFormData({...formData, ifscCode: e.target.value})}
                            placeholder="e.g., SBIN0001234"
                            className={errors.ifscCode ? "border-red-500" : ""}
                          />
                          {errors.ifscCode && (
                            <p className="text-sm text-red-500 mt-1">{errors.ifscCode}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="upiId">UPI ID (Optional)</Label>
                          <Input
                            id="upiId"
                            value={formData.upiId}
                            onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                            placeholder="e.g., user@paytm"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Payment Frequency *</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="weekly"
                              name="paymentFrequency"
                              value="weekly"
                              checked={formData.paymentFrequency === "weekly"}
                              onChange={(e) => setFormData({...formData, paymentFrequency: e.target.value})}
                              className="form-radio"
                              aria-label="Weekly payment frequency"
                            />
                            <Label htmlFor="weekly">Weekly</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="monthly"
                              name="paymentFrequency"
                              value="monthly"
                              checked={formData.paymentFrequency === "monthly"}
                              onChange={(e) => setFormData({...formData, paymentFrequency: e.target.value})}
                              className="form-radio"
                              aria-label="Monthly payment frequency"
                            />
                            <Label htmlFor="monthly">Monthly</Label>
                          </div>
                        </div>
                        {errors.paymentFrequency && (
                          <p className="text-sm text-red-500 mt-1">{errors.paymentFrequency}</p>
                        )}
                      </div>

                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Payment Information</h4>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Payments are processed securely through banking channels</li>
                          <li>• Minimum payout threshold: ₹1,000</li>
                          <li>• Processing time: 3-5 business days</li>
                          <li>• Platform fee: Only 8% on each sale</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Step 6: Your Story */}
                  {currentStep === 6 && (
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="story">Tell us your story or inspiration behind your craft</Label>
                        <Textarea
                          id="story"
                          value={formData.story}
                          onChange={(e) => setFormData({...formData, story: e.target.value})}
                          placeholder="Share your journey, inspiration, and what makes your craft special..."
                          rows={6}
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-1">Upload a Video of Your Craft <span className="text-muted-foreground font-normal">(optional)</span></p>
                        <p className="text-xs text-muted-foreground mb-3">Share a short video of you or your team making the craft</p>
                        <VideoUpload
                          value={formData.craftVideo}
                          onChange={(url) => setFormData({ ...formData, craftVideo: url })}
                        />
                      </div>

                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h3 className="font-medium mb-2">Declaration</h3>
                        <div className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              id="declaration1"
                              className="form-checkbox mt-1"
                              aria-label="I confirm that all details provided are true and correct"
                            />
                            <Label htmlFor="declaration1" className="text-sm">
                              I confirm that all details provided are true and correct.
                            </Label>
                          </div>
                          <div className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              id="declaration2"
                              className="form-checkbox mt-1"
                              aria-label="I agree to follow the Zaymazone Seller Compliance Policy"
                            />
                            <Label htmlFor="declaration2" className="text-sm">
                              I agree to follow the Zaymazone Seller Compliance Policy.
                            </Label>
                          </div>
                          <div className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              id="declaration3"
                              className="form-checkbox mt-1"
                              aria-label="I understand that fake or misleading information may result in account suspension"
                            />
                            <Label htmlFor="declaration3" className="text-sm">
                              I understand that fake or misleading information may result in account suspension.
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}



                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-6">
                    <Button 
                      variant="outline" 
                      onClick={handlePrevious} 
                      disabled={currentStep === 1}
                    >
                      Previous
                    </Button>
                    {currentStep < totalSteps ? (
                      <Button 
                        onClick={handleNext}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          "Next Step"
                        )}
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleSubmit} 
                        className="btn-hero"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Dashboard Preview */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Your Future Dashboard
                  </CardTitle>
                  <CardDescription>
                    Preview of what you'll get as a Zaymazone artisan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboardFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <feature.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Quick Stats Preview</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Average Monthly Sales</span>
                        <span className="font-medium">₹25,000+</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Customer Reach</span>
                        <span className="font-medium">Pan-India</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Commission Rate</span>
                        <span className="font-medium text-green-600">Only 8%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}