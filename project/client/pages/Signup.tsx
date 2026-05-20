import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Upload, Loader2 } from "lucide-react";

// Catalog (display only — server is authoritative)
const CARS: Record<string, { name: string; weekly: number; monthly: number }> = {
  "1": { name: "Chrysler 200", weekly: 349, monthly: 1199 },
  "2": { name: "Chevy Camaro", weekly: 399, monthly: 1349 },
  "3": { name: "Chevy Tahoe", weekly: 479, monthly: 1599 },
};

// Optional integrations — only used if the corresponding env vars are set.
const FORMSPREE_ENDPOINT = import.meta.env.VITE_FORMSPREE_ENDPOINT as
  | string
  | undefined;
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as
  | string
  | undefined;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env
  .VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

async function uploadToCloudinary(file: File): Promise<string | null> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) return null;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const r = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: fd },
  );
  if (!r.ok) throw new Error("Cloudinary upload failed");
  const data = await r.json();
  return data.secure_url as string;
}

export default function Signup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const carId = searchParams.get("carId") || "";
  const plan = (searchParams.get("plan") as "weekly" | "monthly") || "";
  const car = CARS[carId];
  const price =
    car && (plan === "weekly" || plan === "monthly")
      ? plan === "weekly"
        ? car.weekly
        : car.monthly
      : null;

  const hasSelection = useMemo(
    () =>
      Boolean(car) && (plan === "weekly" || plan === "monthly") && price !== null,
    [car, plan, price],
  );

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    licenseFile: null as File | null,
    idFile: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: "licenseFile" | "idFile",
  ) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, [fileType]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasSelection) {
      setErrorMsg(
        "Please pick a car and a plan first (Weekly or Monthly) from the vehicle page.",
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1) Optional: upload license + ID to Cloudinary if configured
      let licenseUrl: string | null = null;
      let idUrl: string | null = null;
      if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
        if (formData.licenseFile) {
          licenseUrl = await uploadToCloudinary(formData.licenseFile);
        }
        if (formData.idFile) {
          idUrl = await uploadToCloudinary(formData.idFile);
        }
      }

      // 2) Optional: send Formspree email with all booking details
      if (FORMSPREE_ENDPOINT) {
        const payload = {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          selectedCar: car!.name,
          plan,
          selectedPrice: `$${price} / ${plan === "weekly" ? "week" : "month"}`,
          licenseUrl: licenseUrl || "(not uploaded — Cloudinary not configured)",
          idUrl: idUrl || "(not uploaded — Cloudinary not configured)",
        };
        try {
          await fetch(FORMSPREE_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          });
        } catch (err) {
          console.warn("Formspree submission failed (continuing):", err);
        }
      }

      // 3) Create Stripe Checkout subscription session and redirect
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          plan,
          customerEmail: formData.email,
          customerName: formData.fullName,
          phone: formData.phone,
          licenseUrl: licenseUrl || "",
          idUrl: idUrl || "",
          originUrl: window.location.origin,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Checkout failed (${res.status})`);
      }
      const data = await res.json();
      if (!data.url) throw new Error("No checkout URL returned");

      // Redirect to real Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error("Submit error:", err);
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
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

        {/* Selected car/plan summary */}
        {hasSelection ? (
          <div
            data-testid="booking-summary"
            className="mb-8 rounded-lg border border-accent/30 bg-accent/5 p-4"
          >
            <p className="text-sm text-foreground/60 mb-1">You're booking</p>
            <p className="text-lg font-bold text-foreground">
              <span data-testid="summary-car">{car!.name}</span> ·{" "}
              <span data-testid="summary-plan" className="capitalize">
                {plan}
              </span>{" "}
              plan
            </p>
            <p className="text-accent font-bold text-xl mt-1">
              <span data-testid="summary-price">${price}</span> /{" "}
              {plan === "weekly" ? "week" : "month"} (recurring until canceled)
            </p>
            <Link
              to={`/vehicle/${carId}`}
              className="text-sm text-accent hover:underline mt-2 inline-block"
            >
              Change car or plan
            </Link>
          </div>
        ) : (
          <div
            data-testid="no-selection-warning"
            className="mb-8 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
          >
            <p className="font-bold">No car or plan selected</p>
            <p className="text-sm mt-1">
              Please{" "}
              <Link to="/" className="underline">
                pick a car
              </Link>{" "}
              and choose Weekly or Monthly first.
            </p>
          </div>
        )}

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
              data-testid="signup-fullname"
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
              data-testid="signup-email"
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
              data-testid="signup-phone"
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
                data-testid="signup-license-input"
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
                data-testid="signup-id-input"
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

          {errorMsg && (
            <p
              data-testid="signup-error"
              className="text-red-600 text-sm font-medium"
            >
              {errorMsg}
            </p>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={submitting || !hasSelection}
            data-testid="signup-submit-btn"
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg py-3 mt-8 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Processing…
              </span>
            ) : (
              "Submit Application & Pay"
            )}
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
