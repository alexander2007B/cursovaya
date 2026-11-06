import { ArrowUpRight } from "lucide-react";
// Original vector artwork: a road folded into the NORDÉ monogram.
export default function RouteSculpture() {
  const route = "M145 370 V150 Q145 100 187 133 L372 344 Q415 385 415 330 V100";
  return (
    <div className="route-sculpture" aria-hidden="true">
      <div className="sculpture-coordinate">N / 59°13′</div>
      <div className="sculpture-compass">
        <ArrowUpRight size={24} />
      </div>
      <svg viewBox="0 0 560 490" className="route-object" fill="none">
        <defs>
          <linearGradient
            id="road-side"
            x1="120"
            y1="120"
            x2="430"
            y2="380"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#046998" />
            <stop offset=".4" stopColor="#003355" />
            <stop offset=".65" stopColor="#0398d6" />
            <stop offset="1" stopColor="#012c50" />
          </linearGradient>
          <linearGradient
            id="road-surface"
            x1="145"
            y1="120"
            x2="415"
            y2="370"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#bceaff" />
            <stop offset=".23" stopColor="#239bd0" />
            <stop offset=".48" stopColor="#086c9b" />
            <stop offset=".68" stopColor="#70c9ef" />
            <stop offset="1" stopColor="#d5f4ff" />
          </linearGradient>
          <linearGradient
            id="road-inner"
            x1="150"
            y1="140"
            x2="410"
            y2="360"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#104562" />
            <stop offset=".5" stopColor="#082a47" />
            <stop offset="1" stopColor="#135274" />
          </linearGradient>
          <filter id="road-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>
        <g className="route-orbits" stroke="#7ab6db" strokeOpacity=".2">
          <ellipse
            cx="280"
            cy="284"
            rx="240"
            ry="110"
            transform="rotate(-25 280 284)"
          />
          <ellipse
            cx="280"
            cy="284"
            rx="200"
            ry="150"
            transform="rotate(-25 280 284)"
            strokeDasharray="2 9"
          />
        </g>
        <g transform="translate(0 15) rotate(-15 280 245) skewY(-4)">
          <path
            d={route}
            transform="translate(5 35)"
            stroke="#000"
            strokeOpacity=".5"
            strokeWidth="78"
            filter="url(#road-shadow)"
          />
          <path
            d={route}
            transform="translate(0 17)"
            stroke="url(#road-side)"
            strokeWidth="70"
            strokeLinecap="butt"
          />
          <path
            d={route}
            stroke="url(#road-surface)"
            strokeWidth="70"
            strokeLinecap="butt"
          />
          <path
            d={route}
            stroke="url(#road-inner)"
            strokeWidth="48"
            strokeLinecap="butt"
          />
          <path
            d={route}
            stroke="#d9f3ff"
            strokeOpacity=".8"
            strokeWidth="2"
            strokeDasharray="10 13"
          />
          <path d="M115 370h60M385 100h60" stroke="#d7f5ff" strokeWidth="3" />
          <g transform="translate(338 305) rotate(-42)">
            <rect
              x="-10"
              y="-19"
              width="20"
              height="36"
              rx="7"
              fill="#f1f9ff"
            />
            <rect x="-8" y="-10" width="16" height="15" rx="4" fill="#0a2341" />
            <path d="M-7 12h14" stroke="#fc734d" strokeWidth="2" />
          </g>
        </g>
        <circle cx="459" cy="339" r="5" fill="#ff936c" />
        <circle cx="459" cy="339" r="12" stroke="#ff936c" strokeOpacity=".4" />
      </svg>
      <div className="sculpture-tag">
        <span className="sculpture-tag-dot" />
        <span>
          ВАШ МАРШРУТ
          <br />
          <b>начинается здесь.</b>
        </span>
        <span className="sculpture-tag-arrow">
          <ArrowUpRight size={22} />
        </span>
      </div>
      <div className="sculpture-caption">
        <span>NORDÉ / MOVE FREELY</span>
        <span>01 — ∞</span>
      </div>
    </div>
  );
}
