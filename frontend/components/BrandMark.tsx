import Image from "next/image";

/** Logo de FyDry Task. Único lugar donde se define el archivo del logo. */
export default function BrandMark({ size = 36, priority = true }: { size?: number; priority?: boolean }) {
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <Image src="/logo_task.svg" alt="FyDry Task Logo" fill sizes={`${size}px`} className="object-contain" priority={priority} />
    </div>
  );
}
