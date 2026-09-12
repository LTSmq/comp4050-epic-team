import Link from "next/link";

export default function ThomaxBrand() {
  return (
    <Link href="/" className="thomaxBrand">
      <img
        src="/public/imagee.png"
        alt="Thomax"
        className="thomaxLogo"
      />

      <span className="thomaxProduct">
        .wms · Perfect Fit
      </span>
    </Link>
  );
}