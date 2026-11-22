import { useState, useEffect } from "react";

/**
 * Functional, handcrafted SVG Analog Watch Face.
 * Ticks live in Asia/Kolkata (IST) time with a signature red second hand,
 * premium watch bezel, and digital time display underneath.
 */
const AnalogClock = ({ className = "" }) => {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(
        new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Hand angles
  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;

  // Digital time formatting
  const digitalTime = time.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
    >
      {/* Soft light-red glow behind the watch */}
      <div className="absolute w-44 h-44 rounded-full bg-[#E53935]/[0.08] blur-2xl pointer-events-none" />

      {/* SVG Watch Face */}
      <div className="relative w-48 h-48 sm:w-52 sm:h-52 drop-shadow-sm">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Subtle inner shadow for dial */}
            <radialGradient id="dialGradient" cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#F8F9FA" />
            </radialGradient>
            <filter
              id="shadowFilter"
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
              <feDropShadow
                dx="0"
                dy="1"
                stdDeviation="1.5"
                floodColor="#000"
                floodOpacity="0.1"
              />
            </filter>
          </defs>

          {/* Outer Polished Ring Bezel */}
          <circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1.5"
          />
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="url(#dialGradient)"
            stroke="#F1F3F5"
            strokeWidth="2"
          />

          {/* Minute tick marks (60 ticks) */}
          {Array.from({ length: 60 }).map((_, i) => {
            const isHourTick = i % 5 === 0;
            const angle = (i * 6 * Math.PI) / 180;
            const rInner = isHourTick ? 76 : 81;
            const rOuter = 85;
            const x1 = 100 + rInner * Math.sin(angle);
            const y1 = 100 - rInner * Math.cos(angle);
            const x2 = 100 + rOuter * Math.sin(angle);
            const y2 = 100 - rOuter * Math.cos(angle);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isHourTick ? "#9CA3AF" : "#E5E7EB"}
                strokeWidth={isHourTick ? "2" : "1"}
                strokeLinecap="round"
              />
            );
          })}

          {/* 12, 3, 6, 9 Numerals */}
          <text
            x="100"
            y="35"
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-bold text-[13px] fill-[#202124] font-heading"
          >
            12
          </text>
          <text
            x="167"
            y="101"
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-bold text-[13px] fill-[#202124] font-heading"
          >
            3
          </text>
          <text
            x="100"
            y="167"
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-bold text-[13px] fill-[#202124] font-heading"
          >
            6
          </text>
          <text
            x="33"
            y="101"
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-bold text-[13px] fill-[#202124] font-heading"
          >
            9
          </text>

          {/* Brand Accent at top */}
          <circle cx="100" cy="50" r="2" fill="#E53935" />

          {/* Hour Hand */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="54"
            stroke="#202124"
            strokeWidth="4"
            strokeLinecap="round"
            transform={`rotate(${hourAngle} 100 100)`}
            filter="url(#shadowFilter)"
          />

          {/* Minute Hand */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="38"
            stroke="#4B5563"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${minuteAngle} 100 100)`}
            filter="url(#shadowFilter)"
          />

          {/* Second Hand (Red with small tail) */}
          <g transform={`rotate(${secondAngle} 100 100)`}>
            <line
              x1="100"
              y1="116"
              x2="100"
              y2="28"
              stroke="#E53935"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="116" r="3" fill="#E53935" />
          </g>

          {/* Center Pivot Cap */}
          <circle cx="100" cy="100" r="4.5" fill="#E53935" />
          <circle cx="100" cy="100" r="2" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Digital Time & Date Underneath */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-mono text-xs font-bold text-[#202124]">
            {digitalTime}
          </span>
          <span className="text-[10px] font-bold text-[#E53935] uppercase tracking-wider bg-[#FFF1F0] px-1.5 py-0.5 rounded-md">
            IST
          </span>
        </div>
        <p className="text-[11px] text-[#6B7280] font-medium mt-0.5">
          {formattedDate}
        </p>
      </div>
    </div>
  );
};

export default AnalogClock;
