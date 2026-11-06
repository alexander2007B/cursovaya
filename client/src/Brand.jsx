export function BrandSymbol({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 37V11h7l18 26h7V11"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="miter"
      />
      <path
        d="m20 11 20 26M8 11l20 26"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".45"
      />
    </svg>
  );
}
export default function Brand() {
  return (
    <>
      <BrandSymbol className="norde-symbol" />
      <span className="norde-wordmark">
        NORDÉ<small>DRIVE YOUR WAY</small>
      </span>
    </>
  );
}
