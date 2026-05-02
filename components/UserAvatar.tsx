import React from "react";

type Props = {
  imageUrl?: string | null;
  initials: string;
  /** Pixel width/height */
  size?: number;
  className?: string;
};

export const UserAvatar: React.FC<Props> = ({ imageUrl, initials, size = 32, className = "" }) => {
  const dim = `${size}px`;
  const letter = (initials.trim().slice(0, 1) || "U").toUpperCase();
  const textClass = size >= 56 ? "text-xl" : size >= 40 ? "text-sm" : "text-xs";

  if (imageUrl?.trim()) {
    return (
      <div
        className={`shrink-0 rounded-full overflow-hidden bg-slate-100 ring-2 ring-white ${className}`}
        style={{ width: dim, height: dim }}
      >
        <img src={imageUrl.trim()} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center ${textClass} ${className}`}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      {letter}
    </div>
  );
};
