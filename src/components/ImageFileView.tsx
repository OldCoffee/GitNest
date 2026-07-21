import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { Button, EmptyState } from "./ui";

export function ImageFileView({
  absolutePath,
  alt,
  onOpenInSystem,
}: {
  absolutePath: string | null;
  alt: string;
  onOpenInSystem?: () => void;
}) {
  const { t } = usePreferences();
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => {
    if (!absolutePath) return null;
    try {
      return convertFileSrc(absolutePath);
    } catch {
      return null;
    }
  }, [absolutePath]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <EmptyState>{t("fileEditor.imageLoadFailed")}</EmptyState>
        {onOpenInSystem && (
          <Button onClick={onOpenInSystem}>{t("fileEditor.openInSystem")}</Button>
        )}
      </div>
    );
  }

  return (
    <div className="jb-image-view jb-scroll min-h-0 flex-1 overflow-auto">
      <img
        key={src}
        src={src}
        alt={alt}
        className="jb-image-view-img"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
