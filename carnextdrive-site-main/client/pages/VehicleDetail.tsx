import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { Users, Zap, Wind } from "lucide-react";

const vehicleData: Record<string, any> = {
  "1": {
    name: "Chevy Tahoe",
    type: "SUV",
    price: 295,
    seats: 8,
    image: "https://images.unsplash.com/photo-1606611013016-969c19d4eeb9?w=800&h=600&fit=crop",
    description:
      "A spacious and comfortable SUV perfect for families and group trips. The Chevy Tahoe offers excellent performance and luxury amenities.",
    features: [
      "All-Wheel Drive",
      "Cruise Control",
      "Backup Camera",
      "Bluetooth Connectivity",
      "Climate Control",
      "Leather Seats",
    ],
  },
  "2": {
    name: "Toyota Corolla",
    type: "Sedan",
    price: 249,
    seats: 5,
    image: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
    description:
      "Reliable and fuel-efficient sedan ideal for daily commuting. The Toyota Corolla is known for its dependability and smooth ride.",
    features: [
      "Fuel Efficient",
      "Backup Camera",
      "Touchscreen Display",
      "Bluetooth Connectivity",
      "Air Conditioning",
      "Power Windows",
    ],
  },
  "3": {
    name: "Hyundai Elantra",
    type: "Sedan",
    price: 225,
    seats: 5,
    image: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?w=800&h=600&fit=crop",
    description:
      "Stylish and efficient sedan with modern features. The Hyundai Elantra offers great value and contemporary design.",
    features: [
      "Backup Camera",
      "Bluetooth Connectivity",
      "Climate Control",
      "Apple CarPlay/Android Auto",
      "Power Locks",
      "Air Conditioning",
    ],
  },
};

export default function VehicleDetail() {
  const { id } = useParams();
  const vehicle = vehicleData[id || "1"];

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Vehicle not found
          </h2>
          <Link to="/">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="text-accent hover:text-accent/90 font-medium mb-8 inline-block"
        >
          ← Back to Cars
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Vehicle Image */}
          <div className="relative h-96 lg:h-full min-h-96 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={vehicle.image}
              alt={vehicle.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Vehicle Details */}
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-accent font-semibold mb-2">{vehicle.type}</p>
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
                {vehicle.name}
              </h1>

              <p className="text-lg text-foreground/70 mb-8">
                {vehicle.description}
              </p>

              {/* Key Info */}
              <div className="grid grid-cols-2 gap-6 mb-8 py-8 border-y border-border">
                <div>
                  <p className="text-foreground/60 text-sm font-medium">
                    Weekly Price
                  </p>
                  <p className="text-3xl font-bold text-accent">
                    ${vehicle.price}
                  </p>
                </div>
                <div>
                  <p className="text-foreground/60 text-sm font-medium">
                    Passengers
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="w-6 h-6 text-accent" />
                    <p className="text-2xl font-bold text-foreground">
                      {vehicle.seats}
                    </p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-foreground mb-4">
                  Features
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {vehicle.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-accent rounded-full"></div>
                      <span className="text-foreground/70">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Book Button */}
            <Link to="/signup">
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg py-6">
                Book This Car
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
