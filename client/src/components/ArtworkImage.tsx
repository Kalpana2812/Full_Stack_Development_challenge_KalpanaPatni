import { useState } from "react";

export function ArtworkImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-slate-800 ${className}`}>
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />}
      {failed ? <div className="flex h-full min-h-24 items-end p-4 text-sm font-semibold text-white/70">Artwork unavailable</div> : <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`h-full w-full object-cover transition duration-500 ${loaded ? "scale-100 opacity-100" : "scale-105 opacity-0"}`} />}
    </div>
  );
}
