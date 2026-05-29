import { useState, useMemo, useEffect } from "react";
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

// Server-side upload: streams the files through our /api/upload endpoint
// which talks to Cloudinary using server-only credentials. Returns the
// public Cloudinary URLs that we then attach to the Stripe session.
async function uploadFilesToServer(
  licenseFile: File,
  idFile: File,
): Promise<{ licenseUrl: string; idUrl: string }> {
  const fd = new FormData();
  fd.append("license", licenseFile);
  fd.append("id", idFile);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    let parsed: any = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      // ignore
    }
    throw new Error(
      parsed?.error ||
        `File upload failed (server returned ${r.status}). Check Cloudinary credentials on the server.`,
    );
  }
  const data = (await r.json()) as { licenseUrl: string; idUrl: string };
  if (!data.licenseUrl || !data.idUrl) {
    throw new Error("Upload succeeded but URLs are missing.");
  }
  return data;
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

  // localStorage key used to recover form data if the page is reloaded
  // mid-application (e.g. Stripe redirect cancellation, accidental refresh).
  // Files cannot be persisted to localStorage so the user re-attaches them.
  const STORAGE_KEY = "carnextdrive:signup-form";

  const [formData, setFormData] = useState<{
    fullName: string;
    email: string;
    phone: string;
    licenseFile: File | null;
    idFile: File | null;
  }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<{
            fullName: string;
            email: string;
            phone: string;
          }>;
          return {
            fullName: saved.fullName || "",
            email: saved.email || "",
            phone: saved.phone || "",
            licenseFile: null,
            idFile: null,
          };
        }
      } catch {
        // ignore — start fresh
      }
    }
    return {
      fullName: "",
      email: "",
      phone: "",
      licenseFile: null,
      idFile: null,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Persist text fields to localStorage on every change so an accidental
  // refresh doesn't wipe what the customer has typed.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
        }),
      );
    } catch {
      // localStorage may be disabled (private mode) — non-fatal
    }
  }, [formData.fullName, formData.email, formData.phone]);

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

  const submitApplication = async () => {
    setErrorMsg(null);

    // Validate required fields in JS so we control error messaging
    if (!hasSelection) {
      setErrorMsg(
        "Please pick a car and a plan first (Weekly or Monthly) from the vehicle page.",
      );
      return;
    }
    if (!formData.fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!formData.email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }
    if (!formData.licenseFile) {
      setErrorMsg("Please upload a photo of your driver license.");
      return;
    }
    if (!formData.idFile) {
      setErrorMsg("Please upload a photo of your ID.");
      return;
    }

    setSubmitting(true);
    console.log("[booking] Submitting application…", {
      carId,
      plan,
      price,
    });

    try {
      // 1) Upload license + ID to Cloudinary via our server (signed upload).
      console.log("[booking] Uploading license + ID to server…");
      let licenseUrl = "";
      let idUrl = "";
      try {
        const up = await uploadFilesToServer(
          formData.licenseFile,
          formData.idFile,
        );
        licenseUrl = up.licenseUrl;
        idUrl = up.idUrl;
        console.log("[booking] Cloudinary uploads OK", { licenseUrl, idUrl });
      } catch (upErr: any) {
        console.error("[booking] Upload failed:", upErr);
        throw new Error(
          upErr?.message ||
            "We couldn't upload your documents. Please try again.",
        );
      }

      // 2) Formspree email is sent SERVER-SIDE after Stripe confirms payment
      //    (see /api/notify/:sessionId and the Stripe webhook). No client
      //    Formspree call here.

      // 3) Create Stripe Checkout subscription session and redirect.
      //    The license/ID URLs travel along in session metadata so the
      //    backend can include them in the application email.
      console.log("[booking] Creating Stripe Checkout session…");
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          plan,
          customerEmail: formData.email,
          customerName: formData.fullName,
          phone: formData.phone,
          licenseUrl,
          idUrl,
          originUrl: window.location.origin,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let parsed: any = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          // not JSON
        }
        console.error(
          "[booking] /api/create-checkout-session failed:",
          res.status,
          body,
        );
        throw new Error(
          parsed?.error ||
            `Payment could not be started (server returned ${res.status}). Make sure STRIPE_SECRET_KEY is set on the server.`,
        );
      }
      const data = await res.json();
      if (!data.url) {
        throw new Error("Stripe did not return a checkout URL.");
      }
      console.log("[booking] Redirecting to Stripe:", data.url);

      // Redirect to real Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error("[booking] Submit error:", err);
      setErrorMsg(
        err?.message ||
          "Something went wrong starting your payment. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    // Belt-and-braces: even though the submit button is now type="button",
    // also block any accidental form submission (e.g. user hits Enter inside
    // an input).
    e.preventDefault();
    e.stopPropagation();
    void submitApplication();
    return false;
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

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
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
            <div
              data-testid="signup-error"
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
            >
              <span className="text-xl leading-none">⚠</span>
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="button"
            onClick={submitApplication}
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
