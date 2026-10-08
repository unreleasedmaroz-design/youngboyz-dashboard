// Company logo. "full" = YOUNG BOYZ + MUSIC MENA, "wordmark" = YOUNG BOYZ only.
export default function Logo({ variant = "full", width = 220, className = "" }) {
  const full = variant === "full";
  const ratio = full ? 746 / 123 : 746 / 75; // source image proportions
  return (
    <img
      className={`logo ${className}`}
      src={full ? "/logo-full.png" : "/logo-wordmark.png"}
      alt="Young Boyz Music MENA"
      width={width}
      height={Math.round(width / ratio)}
    />
  );
}
