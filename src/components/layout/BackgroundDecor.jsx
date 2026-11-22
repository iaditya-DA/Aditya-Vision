import { Truck, Package, IndianRupee, MapPin, Clock } from "lucide-react";

/**
 * Reusable decorative background graphics for all pages.
 * Very light, elegant, and entirely non-intrusive (pointer-events-none).
 * Increased visibility: 12-15% top-right blob, 10% bottom-left blob,
 * 10% dotted grid, 8-10% line-art icons in margins.
 */
const BackgroundDecor = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* 1. Large soft blurred light-red gradient blob in top-right (~12-15% opacity) */}
      <div className="absolute -top-24 -right-24 w-[600px] h-[600px] rounded-full bg-[#E53935]/[0.14] blur-[130px]" />

      {/* 2. Secondary soft warm tint in bottom-left (~10% opacity) */}
      <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] rounded-full bg-[#E53935]/[0.10] blur-[120px]" />

      {/* 3. Dotted grid pattern in top-left corner (~10% opacity) */}
      <svg
        className="absolute top-0 left-0 w-96 h-96 opacity-[0.10]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dotted-grid"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.5" fill="#E53935" />
          </pattern>
          <radialGradient id="fade-mask" cx="0" cy="0" r="80%">
            <stop offset="0%" stopColor="#000" stopOpacity="1" />
            <stop offset="70%" stopColor="#000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#fade-mask)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#dotted-grid)"
          mask="url(#grid-mask)"
        />
      </svg>

      {/* 4. Tasteful line-art icons in margins and around hero area (~8-10% opacity) */}
      {/* Top-right margin: Delivery Truck */}
      <div className="absolute top-24 right-10 text-[#E53935] opacity-[0.09] rotate-12 transform scale-125">
        <Truck className="w-28 h-28 stroke-[1.2]" />
      </div>

      {/* Top-left / hero margin: Parcel Box */}
      <div className="absolute top-36 left-8 text-[#E53935] opacity-[0.09] -rotate-12 transform scale-110">
        <Package className="w-28 h-28 stroke-[1.2]" />
      </div>

      {/* Mid-right margin: Rupee Coin */}
      <div className="absolute top-1/2 right-8 text-[#E53935] opacity-[0.08] rotate-6 transform scale-100">
        <IndianRupee className="w-24 h-24 stroke-[1.2]" />
      </div>

      {/* Mid-left margin: Location Pin */}
      <div className="absolute top-2/3 left-8 text-[#E53935] opacity-[0.08] -rotate-8 transform scale-95">
        <MapPin className="w-22 h-22 stroke-[1.2]" />
      </div>

      {/* Bottom-right margin: Clock */}
      <div className="absolute bottom-20 right-12 text-[#E53935] opacity-[0.09] rotate-15 transform scale-105">
        <Clock className="w-24 h-24 stroke-[1.2]" />
      </div>
    </div>
  );
};

export default BackgroundDecor;
