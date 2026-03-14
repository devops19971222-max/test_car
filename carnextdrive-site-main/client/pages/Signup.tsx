import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Upload } from "lucide-react";

export default function Signup() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    licenseFile: null as File | null,
    idFile: null as File | null,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "licenseFile" | "idFile"
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      [fileType]: file,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-2xl mx-auto px-6 sm:px-12 py-20">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Apply for a Car
          </h1>
          <p className="text-lg text-foreground/70">
            Submit your information to get approved
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="John Doe"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="john@example.com"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>

          {/* Upload Driver License */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Upload Driver License
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                onChange={(e) => handleFileChange(e, "licenseFile")}
                className="hidden"
                id="license-upload"
                accept="image/*,.pdf"
                required
              />
              <label htmlFor="license-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-foreground font-medium">
                  Click to upload your license
                </p>
                <p className="text-sm text-foreground/60">
                  {formData.licenseFile
                    ? formData.licenseFile.name
                    : "PNG, JPG, or PDF"}
                </p>
              </label>
            </div>
          </div>

          {/* Upload ID */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Upload ID
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors cursor-pointer">
              <input
                type="file"
                onChange={(e) => handleFileChange(e, "idFile")}
                className="hidden"
                id="id-upload"
                accept="image/*,.pdf"
                required
              />
              <label htmlFor="id-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-accent mx-auto mb-2" />
                <p className="text-foreground font-medium">
                  Click to upload your ID
                </p>
                <p className="text-sm text-foreground/60">
                  {formData.idFile ? formData.idFile.name : "PNG, JPG, or PDF"}
                </p>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg py-3 mt-8"
          >
            Submit Application
          </Button>

          <p className="text-center text-sm text-foreground/60 mt-4">
            Already have an account?{" "}
            <Link to="/dashboard" className="text-accent hover:text-accent/90">
              Sign in here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
